$.ajaxSetup({
  contentType: "application/json; charset=utf-8"
});

var current_act_array;
var spritemap_url;
var LAYER;
var DLA_PRESENT;

// flux_data has all the csv from the spectra
var global_start;


var svg = d3.select("svg"),
    margin = {top: 20, right: 20, bottom: 110, left: 40},
    margin2 = {top: 430, right: 20, bottom: 30, left: 40},
    width = +svg.attr("width") - margin.left - margin.right,
    height = +svg.attr("height") - margin.top - margin.bottom,
    height2 = +svg.attr("height") - margin2.top - margin2.bottom;

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

var line = d3.line()
    .x(function(d) { return x(d.wave); })
    .y(function(d) { return y(d.flux); });

var line2 = d3.line()
    .x(function(d) { return x2(d.wave); })
    .y(function(d) { return y2(d.flux); });

svg.append("defs").append("clipPath")
    .attr("id", "clip")
    .append("rect")
    .attr("width", width)
    .attr("height", height);

var focus = svg.append("g")
    .attr("class", "focus")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var pointer = focus.append("svg")
    .attr("class", "pointer_container")
    // .attr("viewBox", "0, 36.7, 143, 1");
    .attr("viewBox", "0, 36.7, 143, 1");


var context = svg.append("g")
    .attr("class", "context")
    .attr("transform", "translate(" + margin2.left + "," + margin2.top + ")");


function drawPlot(data) {

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
        };

function brushed() {
  // WHen brush is moved, delete ability to look over sprites.
  d3.select("#spritediv").selectAll("*").remove();
  pointer.selectAll("rect").remove();

  d3.select("#fullmap").selectAll("rect")
        .attr("style", "stroke: hsl(120, 100%, 100%)")


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

drawPlot(flux_data);


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


function createActs() {
    var e = document.getElementById('layers');
    LAYER = e.options[e.selectedIndex].value;
    input = slice_array(flux_data, global_start);
    input.push(LAYER);
    json_input = JSON.stringify(input);

    console.log(LAYER);
    $.post("model_input", json_input, function(response){
        load_activations(response);
    });
    event.preventDefault();

    d3.select("#spritesvg").selectAll("*").remove();
    pointer.selectAll("rect").remove();

    // Add all rectangles based on the layer
    layer_dims = num_channels(LAYER)
    n = layer_dims[0];
    w = layer_dims[1];
    r = layer_dims[2];

    var xs = range(n, r),
    x_pos = 0;

    pointer.selectAll('rect')
    .data(xs)
    .enter()
    .append('rect')
    .attr("x", function(d) { return d; })
    .attr("width", w)
    .attr("height", 55)
//    .attr("style", function(d) {
//        if (DLA_PRESENT) { return 'stroke:green';}
//        else {return 'stroke:red'; }
//    })
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
    var json_dict = JSON.parse(str);
    current_act_array = json_dict['act_dictionary'];
    DLA_PRESENT = json_dict['dla'];
    avg_acts = json_dict['avg_acts']
    spritemap_url = "https://storage.googleapis.com/dla_spritemaps/1d_spritemaps/" + LAYER + "/" + LAYER + '_'
    update_sprites(0);
    display_spritemap(spritemap_url, LAYER, avg_acts);
    var style_color;
    if (DLA_PRESENT) {
        style_color = "stroke:green";
    }else {
        style_color = "stroke:red";
    }
    d3.select(".selected").attr("style", style_color);
}

function update_sprites(mouse_pos) {
    var sprite = d3.select("#spritediv");
    sprite.selectAll("*").remove();

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

    var sprite = d3.select("#fullmap");
    sprite.selectAll("*").remove();

    new_url = s_url.slice(0, -1) + '_resized.png'
    d3.select("#fullmap")
        .append("svg:image")
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

    console.log(xys)
    var test = d3.select("#fullmap");
    test.selectAll('rect')
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
