$.ajaxSetup({
  contentType: "application/json; charset=utf-8"
});

var current_act_array;
var spritemap_url;
var LAYER;

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
  d3.select("#spritesvg").selectAll("*").remove();
  pointer.selectAll("rect").remove();

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
    json_input = JSON.stringify(input)

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

    var xs = range(n),
    x_pos = 0;

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

      current_channel_pos = d/r;
      update_sprites(current_channel_pos);

      pointer.selectAll('rect')
          .attr('class', 'unselected');

      d3.select(this)
        .attr("class", "selected");
//        .attr("style", "stroke:green");
    });
}

function load_activations(str) {
    var json_dict = JSON.parse(str);
    current_act_array = json_dict['act_dictionary'];
    spritemap_url = "https://storage.googleapis.com/dla_spritemaps/1d_spritemaps/" + LAYER + "/" + LAYER + '_'
}

function update_sprites(mouse_pos) {
    var sprite = d3.select("#spritesvg");
    sprite.selectAll("*").remove();

    channel_n = mouse_pos;
    current_sprites = current_act_array[channel_n];

    sprite1 = current_sprites[0]
    sprite2 = current_sprites[1]
    sprite3 = current_sprites[2]
    sprite4 = current_sprites[3]

    s1_url = spritemap_url + sprite1['n'].toString() + '.png';
    s2_url = spritemap_url + sprite2['n'].toString() + '.png';
    s3_url = spritemap_url + sprite3['n'].toString() + '.png';
    s4_url = spritemap_url + sprite4['n'].toString() + '.png';


    sprite.append("svg:image").attr("xlink:href", s1_url)
        .attr("x", 0).attr("y", 343)
        .attr("width", 210).attr("height", 157);

    sprite.append("svg:image").attr("xlink:href", s2_url)
        .attr("x", 210).attr("y", 343)
        .attr("width", 210).attr("height", 157);

    sprite.append("svg:image").attr("xlink:href", s3_url)
        .attr("x", 420).attr("y", 343)
        .attr("width", 210).attr("height", 157);

    sprite.append("svg:image").attr("xlink:href", s4_url)
        .attr("x", 630).attr("y", 343)
        .attr("width", 210).attr("height", 157);

}
