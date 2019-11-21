import os
import json
from flask import Flask, render_template, request, redirect, Response, url_for, flash
from werkzeug.utils import secure_filename
import numpy as np

UPLOAD_FOLDER = 'data/uploads'
ALLOWED_EXTENSIONS = set(['npy'])

import tensorflow as tf
import lucid.modelzoo.vision_models as models
import lucid.optvis.render as render
from lucid.misc.io import show, load


from lucid.modelzoo.vision_base import Model

FILENAME=''

class DLA(Model):
    model_path = 'https://storage.googleapis.com/dla_protobuff/full_model_8_13.pb'
    image_shape = [1, 400]
    image_value_range = [0, 1]
    input_name = 'x'

app = Flask(__name__)
app.secret_key = "secret key"
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/", methods=['POST'])
def upload_file():
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('No file part')
            return redirect(request.url)
        file = request.files['file']
        if file.filename == '':
            flash('No selected file')
            return redirect(request.url)
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            FILENAME = filename
            # return redirect('/')
            return render_template("home.html", filedata=FILENAME)
    return redirect('/')

@app.route("/")
def home():
    return render_template("home.html", data=None)

# @app.route("/plot_uploaded", methods=['POST'])
# def plot_uploaded():
#     print(FILENAME)
#     return None
#     # infile = 'data/uploads/' + FILENAME
#     # print(infile)
#     # data = np.load(infile)
#     # count = 0
#     # arr = []
#     # for f in data:
#     #     vals = {}
#     #     vals['wave']=count
#     #     vals['flux']=f.item()
#     #     arr.append(vals)
#     #     count += 1
#     # flux_data = json.dumps(arr)
#     # return flux_data


@app.route("/plot_flux", methods=['POST'])
def plot_flux():
    data_str = request.get_json()
    infile = data_str
    data = np.load(infile)
    count = 0
    arr = []
    for f in data:
        vals = {}
        vals['wave']=count
        vals['flux']=f.item()
        arr.append(vals)
        count += 1
    flux_data = json.dumps(arr)
    return flux_data

@app.route("/model_input", methods=['POST'])
def worker():
    data = request.get_json()
    layer = data.pop()

    best_acts, dla, acts = run_acts(data, layer)

    act_amounts = get_act_amount(acts)

    avg_channel_acts = get_avg_features(acts)

    dict = {}
    dict['act_dictionary'] = best_acts
    dict['dla'] = dla
    dict['avg_acts'] = avg_channel_acts
    dict['act_amounts'] = act_amounts
    j = json.dumps(dict)
    return j

def get_input(data):
    model_in = []
    for item in data:
        flux = item['flux']
        model_in.append([flux])
    input = np.asarray(model_in)
    input = input.reshape(1, 400, 1, 1)
    return input



LAYERS = { 'conv1': 'Conv2D',
           'conv1_relu':'Relu',
           'pool1': 'MaxPool',
           'conv2': 'Conv2D_1',
           'conv2_relu': 'Relu_1',
           'pool2': 'MaxPool_1',
           'conv3': 'Conv2D_2',
           'conv3_relu': 'Relu_2',
           'pool3': 'MaxPool_2',
         }


model = DLA()

def run_acts(data, layer):
    input = get_input(data)
    # print(input)
    with tf.Graph().as_default(), tf.Session() as sess:
        t_input = tf.placeholder(tf.float32, shape=[1, 400, 1, 1])
        T = render.import_model(model, t_input, t_input)
        acts = T(LAYERS[layer]).eval(feed_dict={t_input: input, 'import/keep_prob:0': .98})[0]

    if layer == 'conv1' or layer == 'conv1_relu':
        acts = acts.reshape(134, 100)
    elif layer == 'pool1':
        acts = acts.reshape(34, 100)
    elif layer == 'conv2' or layer == 'conv2_relu':
        acts = acts.reshape(34, 96)
    elif layer =='pool2' or layer == 'conv3' or layer =='conv3_relu':
        acts = acts.reshape(9, 96)
    elif layer == 'pool3':
        acts = acts.reshape(3, 96)

    best_acts = [[{"n": float(n), "v": float(act_vec[n])} for n in np.argsort(-act_vec)[:4]] for act_vec in acts]
    dla = check_dla(input)

    return best_acts, dla, acts

def check_dla(input):
    with tf.Graph().as_default(), tf.Session() as sess:
        t_input = tf.placeholder(tf.float32, shape=[1, 400, 1, 1])
        T = render.import_model(model, t_input, t_input)
        acts = T('y_nn_classifer').eval(feed_dict={t_input: input, 'import/keep_prob:0': .98})[0]

        if acts > 0:
            return True
        else:
            return False

def get_avg_features(acts):
    num_channels = len(acts)
    num_features = len(acts[0])
    t = np.zeros(num_features)
    for i in range(num_channels):
        for j in range(num_features):
            act_val = acts[i][j]
            t[j] += act_val
    t = t/num_channels
    scaled = scale_avg_features(t)
    return scaled


def scale_avg_features(avg_f):
    """
        Scales pos and negative activations differently
        max is 100, unless an activation is higher
        min is scaled to biggest min value
    """
    p_max = max(30,max(avg_f))
    print(p_max)
    p_new_max = 40          # Dark Green
    p_new_min = 100         # White

    n_min = min(avg_f)
    # print(n_min)
    n_max = 0
    n_new_max = 100         # White
    n_new_min = 40          # Dark Red
    scaled = []
    for val in avg_f:
        if val >= 0:
            new_val = ((val/p_max) * (p_new_max-p_new_min)) + p_new_min
            scaled.append(new_val)
        else:
            new_val = (((val-n_min) / (n_max-n_min)) * (n_new_max-n_new_min)) + n_new_min
            new_val *= -1
            scaled.append(new_val)
    return scaled


def get_act_amount(acts):
    max_acts = []
    for i in range(len(acts)):
        m = max(acts[i])
        vals = {}
        vals['channel'] = i
        vals['act_amount'] = m.item()
        max_acts.append(vals)
    # result = json.dumps(max_acts)
    return max_acts

if __name__ == "__main__":
    app.run(debug=True)