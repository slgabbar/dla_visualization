// define the content type for all ajax requests
$.ajaxSetup({
  contentType: "application/json; charset=utf-8"
});


/*
* Define global variables
* current_act_array - holds the current activation values
* spritempa_url - url for the location of the spritemap
* LAYER - current layer of interest
* DLA_PRESENT - boolean to check if DLA in current 400 width window
*/
var current_act_array;
var spritemap_url;
var LAYER;
var DLA_PRESENT;

// flux data for the  graph
var flux_data;

// start of the data being displayed
var global_start;

var flux_svg = d3.select("#div1").append("svg").attr('width', 960).attr("height", 500),
    margin = {top: 20, right: 20, bottom: 110, left: 40},
    margin2 = {top: 430, right: 20, bottom: 30, left: 40},
    width = +flux_svg.attr("width") - margin.left - margin.right,
    height = +flux_svg.attr("height") - margin.top - margin.bottom,
    height2 = +flux_svg.attr("height") - margin2.top - margin2.bottom;

var x = d3.scaleLinear().range([0, width]),
    x2 = d3.scaleLinear().range([0, width]),
    y = d3.scaleLinear().range([height, 0]),
    y2 = d3.scaleLinear().range([height2, 0]);

var xAxis = d3.axisBottom(x),
    xAxis2 = d3.axisBottom(x2),
    yAxis = d3.axisLeft(y);

// Sets where brush can pan over.
var brush = d3.brushX()
    .extent([[0, 0], [width, height2]])
    .on("brush end", brushed);


// Define some global variables for the main plot!!!!!!
var focus;
var context;
var pointer;
var line;
var line2;


function drawPlot(data) {
//    console.log(data);
    line = d3.line()
        .x(function(d) { return x(d.wave); })
        .y(function(d) { return y(d.flux); });

    line2 = d3.line()
        .x(function(d) { return x2(d.wave); })
        .y(function(d) { return y2(d.flux); });

    flux_svg.append("defs").append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", width)
        .attr("height", height);

    focus = flux_svg.append("g")
        .attr("class", "focus")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    pointer = focus.append("svg")
        .attr("class", "pointer_container")
        .attr("viewBox", "0, 36.7, 143, 1");

    context = flux_svg.append("g")
        .attr("class", "context")
        .attr("transform", "translate(" + margin2.left + "," + margin2.top + ")");

    data.forEach(function(d) {
        d.wave = +d.wave;
        d.flux = +d.flux;
    });

    x.domain(d3.extent(data, function(d) { return d.wave; }));
    y.domain([d3.min(data, function(d) { return d.flux; }) - .05, d3.max(data, function(d) { return d.flux; })]);
    x2.domain(x.domain());
    y2.domain(y.domain());


    focus.append("path")
        .datum(data)
        .attr("class", "line")
        .attr("d", line);

    focus.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    focus.append("g")
        .attr("class", "axis axis--y")
        .call(yAxis);

    context.append("path")
        .datum(data)
        .attr("class", "line")
        .attr("d", line2);

    context.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + height2 + ")")
        .call(xAxis2);

    // brush range seems best [0, 78.2]
    context.append("g")
        .attr("class", "brush")
        .call(brush)
        .call(brush.move, [0, 78.2]);
        }



function plotActivation(data) {
    // set the dimensions and margins of the graph
    var act_svg = d3.select("#div4").append("svg").attr("width", 960).attr("height", 500),
        act_margin = {top: 20, right: 20, bottom: 110, left: 40},
        act_width = +act_svg.attr("width") - act_margin.left - act_margin.right,
        act_height = +act_svg.attr("height") - act_margin.top - act_margin.bottom;

    // set the ranges
    var x = d3.scaleLinear().range([0, act_width]),
        y = d3.scaleLinear().range([act_height, 0]);

    // define the axis's
    var xAxis = d3.axisBottom(x),
        yAxis = d3.axisLeft(y);

    // define the line
    var actline = d3.line()
        .x(function(d) { return x(d.channel); })
        .y(function(d) {return y(d.act_amount); });


    act_focus = act_svg.append("g")
        .attr("class", "focus")
        .attr("transform", "translate(" + act_margin.left + "," + act_margin.top + ")");

    // append group element to the svg
    // moves group element to top left margin
    act_focus.append("g")
        .attr("transform",
              "translate(" + act_margin.left + "," + act_margin.top + ")");

    //  get the data
    data.forEach(function(d) {
        d.channel = +d.channel;
        d.act_amount = +d.act_amount;
    });

    // scale the range of the data
    x.domain(d3.extent(data, function(d) { return d.channel; }));
    y.domain([d3.min(data, function(d) { return d.act_amount; }), d3.max(data, function(d) { return d.act_amount; })]);

    // add the actline path
    act_focus.append('path')
        .datum(data)
        .attr("class", "line")
        .attr("d", actline);

    act_focus.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + act_height + ")")
        .call(xAxis);

    act_focus.append("g")
        .attr("class", "axis axis--y")
        .call(yAxis);
}

function brushed() {
  // WHen brush is moved, delete ability to look over sprites.
  d3.select("#div2").selectAll("*").remove();
  pointer.selectAll("rect").remove();

  // also remove the activation plot
  d3.select("#div4").selectAll("*").remove();

  // if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom
  var s = d3.event.selection || x2.range();

  // get begining of focused axis, set end to +400 to match input of spectra
  var start = Math.floor(s.map(x2.invert, x2)[0]);
  var end = start + 400

  global_start = start;

  x.domain([start, end]);
  focus.select(".line").attr("d", line);
  focus.select(".axis--x").call(xAxis);

  // removes handle to resize the brush
  d3.selectAll('.brush>.handle').remove();
  // removes crosshair cursor
  d3.selectAll('.brush>.overlay').remove();

}

function slice_array(data, start) {
  new_data = data.slice(start, start+400);
  return new_data;
};

function range(n) {
  return Array(n).fill().map((_, i) => i*r);
}

function num_channels(layer) {
  if (layer == 'conv1' || layer == 'conv1_relu') {
    return [134, 1, 1];
  } else if (layer == 'pool1' || layer == 'conv2' || layer == 'conv2_relu') {
    return [34, 3.95, 3.95];
  } else if (layer == 'pool2' || layer == 'conv3' || layer == 'conv3_relu') {
    return [9, 14.9, 14.9];
  } else if (layer == 'pool3') {
    return [3, 44.7, 44.7];
  }
}

function loadData() {
    var e = document.getElementById('flux_data');
    flux = e.options[e.selectedIndex].value;
    flux = flux + '.npy'
    json_input = JSON.stringify(flux);

    $.post("plot_flux", json_input, function(response){
        plot_response(response);
    });
    event.preventDefault();
}

function plot_response(r) {
    flux_svg.selectAll("*").remove();
    var flux_dict = JSON.parse(r);
    flux_data = flux_dict;
    drawPlot(flux_data);
}

function createActs() {
    // Get the current layer from HTML page
    var e = document.getElementById('layers');
    LAYER = e.options[e.selectedIndex].value;

    // slice the spectar data into 400 length input
    // jsonify the input
    input = slice_array(flux_data, global_start);
    input.push(LAYER);
    json_input = JSON.stringify(input);

    // send model input to main.py
    // load_activatrions from response data
    $.post("model_input", json_input, function(response){
        load_activations(response);
    });
    event.preventDefault();

    // Remove all old srpites fronm tghe display
    d3.select("#div3").selectAll("*").remove();
    pointer.selectAll("rect").remove();

    // Add all rectangles based on the layer
    layer_dims = num_channels(LAYER)
    n = layer_dims[0];
    w = layer_dims[1];
    r = layer_dims[2];

    var xs = range(n, r),
    x_pos = 0;

    // highlight only one rectangle based on mouse position
    // start position is always at 0
    pointer.selectAll('rect')
    .data(xs)
    .enter()
    .append('rect')
    .attr("x", function(d) { return d; })
    .attr("width", w)
    .attr("height", 55)
    .attr("class", function(d) {
      if (d == x_pos) {
        return "selected";
      }
      else { return "unselected"; }
    })
    .on("mouseover", function(d) {

      current_channel_pos = Math.floor(d/r);
      update_sprites(current_channel_pos);

      pointer.selectAll('rect')
          .attr('class', 'unselected');
      if (DLA_PRESENT) {
        d3.select(this)
        .attr("class", "selected")
        .attr("style", "stroke:green");
      } else {
        d3.select(this)
        .attr("class", "selected");
      }
    });
}

function load_activations(str) {
    // parse the jscon string from main.py
    var json_dict = JSON.parse(str);

    // initizlaize variables with json data
    current_act_array = json_dict['act_dictionary'];
    DLA_PRESENT = json_dict['dla'];
    avg_acts = json_dict['avg_acts'];
    act_amounts = json_dict['act_amounts'];

    // plot the activation amount
    plotActivation(act_amounts);

    //update sprites at the start position of 0
    spritemap_url = "https://storage.googleapis.com/dla_spritemaps/1d_spritemaps/" + LAYER + "/" + LAYER + '_'
    update_sprites(0);

    //display enttire spritempa with approcpriat ecolor scaling for features
    display_spritemap(spritemap_url, LAYER, avg_acts);

    // set rectangle color to green if dla present
    var style_color;
    if (DLA_PRESENT) {
        style_color = "stroke:green";
    }else {
        style_color = "stroke:red";
    }
    d3.select(".selected").attr("style", style_color);
}

function update_sprites(mouse_pos) {

    d3.select("#div2").selectAll("*").remove();
    var sprite = d3.select("#div2").append("div").attr("class", "dict");

    channel_n = mouse_pos;
    current_sprites = current_act_array[channel_n];
    sprite1 = current_sprites[0];
    sprite2 = current_sprites[1];
    sprite3 = current_sprites[2];
    sprite4 = current_sprites[3];

    s1_url = spritemap_url + sprite1['n'].toString() + '.png';
    s2_url = spritemap_url + sprite2['n'].toString() + '.png';
    s3_url = spritemap_url + sprite3['n'].toString() + '.png';
    s4_url = spritemap_url + sprite4['n'].toString() + '.png';

    denom = 150;
    s1_val = 157*(sprite1['v']/denom);
    if (s1_val < 0) {return 0;}
    s2_val = 157*(sprite2['v']/denom);
    if (s2_val < 0) {return 0;}
    s3_val = 157*(sprite3['v']/denom);
    if (s3_val < 0) {return 0;}
    s4_val = 157*(sprite4['v']/denom);
    if (s4_val < 0) {return 0;}

    var t1 = d3.select(".dict").append("div")
        .attr("class", "entry");
    var s1 = t1.append("div").attr("class", "sprite")
        .attr("style", "background-image: url(" + s1_url + ")");
    var v1 = t1.append("div").attr("class", "value")
        .attr("style", "height: " + s1_val + "px");

    var t2 = d3.select(".dict").append("div")
        .attr("class", "entry");
    var s2 = t2.append("div").attr("class", "sprite")
        .attr("style", "background-image: url(" + s2_url + ")");
    var v2 = t2.append("div").attr("class", "value")
        .attr("style", "height: " + s2_val + "px");

    var t3 = d3.select(".dict").append("div")
        .attr("class", "entry");
    var s3 = t3.append("div").attr("class", "sprite")
        .attr("style", "background-image: url(" + s3_url + ")");
    var v3 = t3.append("div").attr("class", "value")
        .attr("style", "height: " + s3_val + "px");

    var t4 = d3.select(".dict").append("div")
        .attr("class", "entry");
    var s4 = t4.append("div").attr("class", "sprite")
        .attr("style", "background-image: url(" + s4_url + ")");
    var v4 = t4.append("div").attr("class", "value")
        .attr("style", "height: " + s4_val + "px");
}

function display_spritemap(s_url, layer, avg_acts) {
    var num_rows;
    var num_cols;
    var x_factor;
    var y_factor;
    var width;
    var height;
    var x_start;
    var y_start;
    if (layer == 'conv1' || layer == 'conv1_relu' || layer == 'pool1') {
        num_rows = 10;
        num_cols = 10;
        x_factor = 116;
        y_factor = 51.4;
        width = 100;
        height = 41.4;
        x_start = 8;
        y_start = 5;
    } else {
        num_rows = 8;
        num_cols = 12;
        x_factor = 96.66666666666;
        y_factor = 64.25;
        width = 83.3333333333;
        height = 51.75;
        x_start = 6.66666666666;
        y_start = 6.25;
    }

    var sprite = d3.select("#div3").append("svg").attr("width", 1160).attr("height", 500);
//    sprite.selectAll("*").remove();

    new_url = s_url.slice(0, -1) + '_resized.png'
    sprite.append("svg:image")
          .attr("xlink:href", new_url)
          .attr("width", '100%').attr("height", '100%')
          .attr("preserveAspectRatio", "none")
          .attr("x", 0).attr("y",0);

    var xys = []
    count = 0
    for (i = 0; i < num_rows; i++) {
        for (j = 0; j < num_cols; j++) {
            var tmp_y = i * y_factor + y_start;
            var tmp_x = j * x_factor + x_start;
            var c = avg_acts[count];
            data_point = [tmp_y, tmp_x, c];
            xys.push(data_point);
            count += 1;
        }
    }

    sprite.selectAll('rect')
        .data(xys)
        .enter()
        .append('rect')
        .attr("class", "s_rect")
        .attr("height", height).attr("width", width)
        .attr("y", 0)
        .attr("x", function(d) { return d[1]; })
        .attr("y", function(d) { return d[0]; })
        .attr("style", function(d, i) {
            if (d[2] >0) {
                p_floor = Math.floor(d[2]);
                p_str = p_floor.toString() + "%)";
                return "stroke: hsl(100, 100%, " + p_str;
            }else {
                p_pos = d[2] * -1;
                p_floor = Math.floor(p_pos);
                p_str = p_floor.toString() + "%)";
                return "stroke: hsl(0, 100%, " + p_str;
            }
        });

}
