import json
from flask import Flask, render_template, request, redirect, Response
import pandas as pd
import numpy as np


import tensorflow as tf
import lucid.modelzoo.vision_models as models
import lucid.optvis.render as render
from lucid.misc.io import show, load


from lucid.modelzoo.vision_base import Model

class DLA(Model):
    model_path = 'https://storage.googleapis.com/dla_protobuff/full_model_8_13.pb'
    image_shape = [1, 400]
    image_value_range = [0, 1]
    input_name = 'x'

app = Flask(__name__)

@app.route("/")
def home():
    df = pd.read_csv('data/test.csv')
    chart_data = df.to_dict(orient='records')
    chart_data = json.dumps(chart_data, indent=2)
    data = {"chart_data": chart_data}
    return render_template("home.html", data=data)

@app.route("/model_input", methods=['POST'])
def worker():
    data = request.get_json()
    layer = data.pop()

    best_acts, dla, acts = run_acts(data, layer)

    avg_channel_acts = get_avg_features(acts)

    dict = {}
    dict['act_dictionary'] = best_acts
    dict['dla'] = dla
    dict['avg_acts'] = avg_channel_acts
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

    scaled = scale_avg_features(t)
    return scaled

def scale_avg_features(avg_f):
    """
        Scales pos and negative activations differently
    """
    p_max = max(avg_f)
    p_new_max = 40          # Dark Green
    p_new_min = 80         # White

    n_min = min(avg_f)
    n_max = 0
    n_new_max = 80         # White
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



if __name__ == "__main__":
    app.run(debug=True)