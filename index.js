import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const ESCAPE = "Escape";
const RED = "red";
const BLACK = "black"
const NONE = "none";
const RED_COLOR = "rgba(220, 50, 32, 1)"
const BLACK_COLOR = "rgba(0, 0, 0, 1)"
const COLOR_MAP = new Map([[RED, RED_COLOR], [BLACK, BLACK_COLOR], [NONE, "white"]]);
const TEXT_COLOR_MAP = new Map([[RED, "white"], [BLACK, "white"], [NONE, "black"]]);
const BORDER_COLOR_MAP = new Map([[RED, "black"], [BLACK, "white"], [NONE, "black"]]);
const RADIUS = 50;
const NODE_SEP_X = 120;
const NODE_SEP_Y = 150;
let node_clicked_id = null;
let node_hover_id = null;
let edge_hover_id = null;
let max_id = 0;

// Apply a force to align the nodes into a binary tree
function forceBinaryTree(links, strength = 0.1) {
  var nodes, nodeById;

  function initialize() {
    if (!nodes) return;

    nodeById = new Map(nodes.map((d, i) => [d.id, d]));

    links.forEach(link => {
      if (typeof link.parent !== "object") link.parent = nodeById.get(link.parent);
      if (typeof link.child !== "object") link.child = nodeById.get(link.child);
    });
  }

  function force(alpha) {
    links.forEach(link => {
      let par = link.parent;
      let child = link.child;
      // The position we want to move the child to
      let expect_x = par.x;
      if (link.type == "left") {
        expect_x -= child.bst_width_right + NODE_SEP_X;
      } else {
        expect_x += child.bst_width_left + NODE_SEP_X;
      }
      let expect_y = par.y + NODE_SEP_Y;
      // Modify the velocity to move it towards the desired location
      // x alignment is slightly more important, so make the force stronger
      child.vx += (expect_x - child.x) * strength * 1.05 * alpha;
      child.vy += (expect_y - child.y) * strength * alpha;
    });
  }

  force.initialize = function(_nodes, _random) {
    nodes = _nodes;
    initialize();
  };

  return force;
}

// Compute the spacing needed to ensure tree nodes don't overlap
function recomputeSpacing(nodes, links) {
  let nodeById = new Map(nodes.map((d, i) => [d.id, d]));
  links.forEach(link => {
    if (typeof link.parent !== "object") link.parent = nodeById.get(link.parent);
    if (typeof link.child !== "object") link.child = nodeById.get(link.child);
  });
  // Convert edge list to adjacency list
  let leftChild = new Map();
  let rightChild = new Map();
  // Find root node(s)
  let roots = new Set(nodes.map((d, i) => d.id));
  links.forEach(link => {
    roots.delete(link.child.id);
    (link.type == "left" ? leftChild : rightChild).set(link.parent.id, link.child.id);
  });

  // Recursively compute the width needed to ensure
  // that the subtrees don't overlap
  function get_widths(id) {
    let node = nodeById.get(id);
    if (leftChild.has(id)) {
      get_widths(leftChild.get(id));
    }
    if (rightChild.has(id)) {
      get_widths(rightChild.get(id));
    }
    let left = leftChild.has(id) ? nodeById.get(leftChild.get(id)) : null;
    let right = rightChild.has(id) ? nodeById.get(rightChild.get(id)) : null;
    node.bst_width_left = 0;
    node.bst_width_right = 0;
    // If there is a left or right child, the parent needs
    // enough space to hold that child's subtree plus some padding
    if (left != null) {
      node.bst_width_left = NODE_SEP_X + left.bst_width;
    }
    if (right != null) {
      node.bst_width_right = NODE_SEP_X + right.bst_width;
    }
    node.bst_width = node.bst_width_left + node.bst_width_right;
  }
  roots.forEach(get_widths);
}

var width = window.innerWidth,
    height = window.innerHeight;
const menu = document.getElementById("contextMenu");

function showContextMenu(e) {
  menu.style = `width: 300px; left: ${e.pageX}px; top: ${e.pageY}px;`;
}

function hideContextMenu() {
  menu.style = `width: 0px; left: 0px; top: 0px; display: none;`;
}

let svg = d3.select("#d3_container")
  .append("svg")
  .attr("width", width)
  .attr("height", height)
  .on("contextmenu", function(e) {
    showContextMenu(e);
    e.preventDefault();
  });

let nodes = [
    {id: 0, x: 0, y: 0, r: RADIUS, label: "0", color: RED, selected: false}, 
    {id: 1, x: 0, y: 0, r: RADIUS, label: "1", color: BLACK, selected: false}, 
    {id: 2, x: 380, y: 100, r: RADIUS, label: "2", color: NONE, selected: false},
    {id: 3, x: 0, y: 0, r: RADIUS, label: "3", color: NONE, selected: false},
    {id: 4, x: 380, y: 100, r: RADIUS, label: "4", color: "black", selected: false},
    {id: 5, x: 380, y: 100, r: RADIUS, label: "5", color: RED, selected: false},
    {id: 6, x: 380, y: 100, r: RADIUS, label: "6", color: "black", selected: false},
    {id: 7, x: 380, y: 100, r: RADIUS, label: "7", color: "black", selected: false},
];

nodes.forEach(node => {
    max_id = Math.max(max_id, node.id);
});

let bst_edges = [
  {id: 0, parent: 1, child: 0, type: "left", selected: false},
  {id: 1, parent: 1, child: 3, type: "right", selected: false},
  {id: 2, parent: 3, child: 4, type: "right", selected: false},
  {id: 3, parent: 3, child: 2, type: "left", selected: false},
  {id: 4, parent: 0, child: 5, type: "right", selected: false},
  {id: 5, parent: 2, child: 6, type: "left", selected: false},
  {id: 6, parent: 5, child: 7, type: "right", selected: false},
]

let nodeById = new Map(nodes.map((d, i) => [d.id, d]));
let edgeById = new Map(bst_edges.map((d, i) => [d.id, d]));

recomputeSpacing(nodes, bst_edges);

let simulation = d3
  .forceSimulation(nodes)
  .alphaTarget(0.3)
  // .force("repulse", d3.forceManyBody().strength(-120))
  // .force("x_central", d3.forceX(width / 2).strength(0.001))
  // .force("y_central", d3.forceY(height / 2).strength(0.001))
  .force("center", d3.forceCenter(width/2,height/2))
  .force("collide", d3.forceCollide(d => d.r))
  .force("BST", forceBinaryTree(bst_edges))
  .on("tick", tick);

window.onresize = function() {
  width = window.innerWidth;
  height = window.innerHeight;
  svg.attr("width", width).attr("height", height);
  simulation.force("center", d3.forceCenter(width/2,height/2));
}

let g_link = svg.append("g").attr("class", "links");
let link = g_link
  .selectAll(".link")
  .data(bst_edges)
  .enter()
  .append("path")
  .attr("class", "link")
  .on("mouseover", edge_onmouseover)
  .on("mouseout", edge_onmouseout);

let g_node = svg.append("g").attr("class", "nodes");
let node = g_node
  .selectAll(".node")
  .data(nodes)
  .enter()
  .append("g")
  .attr("class", "node")
  .on("mouseover", node_onmouseover)
  .on("mouseout", node_onmouseout)
  .on("dblclick", node_dblclick)
  .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

let shapes = node
  .append("circle")
  .attr("class", "nodeShape")
  .attr("r", d => d.r)
  .style("fill", d => COLOR_MAP.get(d.color))
  .attr("stroke", d => BORDER_COLOR_MAP.get(d.color))
  .attr("stroke-width", d => d.selected ? "4px" : "0px");

let text = node
  .append("text")
  .attr("class", "nodeText")
  .text(d => d.label)
  .attr("text-anchor", "middle")
  .attr("dominant-baseline", "central")
  .attr("font-size", "2.5em")
  .attr("font-family", "sans-serif")
  .attr("fill", d => TEXT_COLOR_MAP.get(d.color));

function redraw() {
  nodeById = new Map(nodes.map((d, i) => [d.id, d]));
  edgeById = new Map(bst_edges.map((d, i) => [d.id, d]));
  recomputeSpacing(nodes, bst_edges);
  simulation
    .nodes(nodes)
    .force("BST", forceBinaryTree(bst_edges))
    .alphaTarget(0.3);

  var update_nodes = g_node.selectAll(".node").data(nodes);

  // node = update_nodes
  //   .enter()
  //   .append("g")
  //   .attr("class", "node")
  //   .on("dblclick", node_dblclick)
  //   .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended))
  //   .on('mouseover', function(e, d) {
  //     d3.select(this).raise();
  //   })
  //   .merge(update_nodes);
  node = update_nodes
    .enter()
    .append("g")
    .attr("class", "node")
    .on("mouseover", node_onmouseover)
    .on("mouseout", node_onmouseout)
    .on("dblclick", node_dblclick)
    .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended))
    .merge(update_nodes);

  node.selectAll("*").remove();

  shapes = node
    .append("circle")
    .attr("class", "nodeShape")
    .attr("r", d => d.r)
    .style("fill", d => COLOR_MAP.get(d.color))
    .attr("stroke", d => BORDER_COLOR_MAP.get(d.color))
    .attr("stroke-width", d => d.selected ? "4px" : "0px")
    .merge(shapes);

  text = node
    .append("text")
    .attr("class", "nodeText")
    .text(d => d.label)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .attr("font-size", "2.5em")
    .attr("font-family", "sans-serif")
    .attr("fill", d => TEXT_COLOR_MAP.get(d.color))
    .merge(text);


  update_nodes.exit().remove();

  var update_links = g_link.selectAll(".link").data(bst_edges);
  update_links.exit().remove();
  link = update_links
    .enter()
    .append("path")
    .attr("stroke-width", "8px")
    .attr("fill", "none")
    .attr("stroke", "black")
    .merge(update_links);
}

function drawChildLink(d) {
  return `M ${d.parent.x},${d.parent.y} Q${d.child.x},${d.parent.y} ${d.child.x},${d.child.y}`
}

function setSelectedColor(color) {
  return function () {
    if (node_clicked_id == null) return;
    nodeById.get(node_clicked_id).color = color;
    shapes.style("fill", d => COLOR_MAP.get(d.color))
      .attr("stroke", d => BORDER_COLOR_MAP.get(d.color))
      .attr("stroke-width", d => d.selected ? "4px" : "0px");
    text.attr("fill", d => TEXT_COLOR_MAP.get(d.color));
  };
}

const data_input = document.getElementById("nodeData");
data_input.disabled = true;
data_input.oninput = function(ev) {
  if (node_clicked_id == null) return;
  nodeById.get(node_clicked_id).label = data_input.value;
  text.text(d => d.label);
};
data_input.value = "";
const none_button = document.getElementById("noneButton");
none_button.onclick = setSelectedColor(NONE);
const red_button = document.getElementById("redButton");
red_button.onclick = setSelectedColor(RED);
const black_button = document.getElementById("blackButton");
black_button.onclick = setSelectedColor(BLACK);
none_button.checked = false;
red_button.checked = false;
black_button.checked = false;
none_button.disabled = true;
red_button.disabled = true;
black_button.disabled = true;

function tick() {
  link.attr("d", d => drawChildLink(d))
  node.attr("transform", d => `translate(${d.x},${d.y})`);
}

var mouseX, mouseY = null;

function addNode() {
  nodes.push({id: max_id + 1, x: mouseX, y: mouseY, r: RADIUS, label: max_id + 1, color: NONE, selected: true});
  max_id += 1;
  if (node_clicked_id != null) {
    nodeById.get(node_clicked_id).selected = false;
  } 
  node_clicked_id = max_id;
  data_input.value = max_id;
  none_button.checked = true;
  red_button.checked = false;
  black_button.checked = false;
  none_button.disabled = false;
  red_button.disabled = false;
  black_button.disabled = false;
  data_input.disabled = false;
  redraw();
}

document.getElementById("menu-item-add-node").onclick = function() {
  hideContextMenu();
  addNode();
}

d3.select("body")
  .on("keydown", function(e) {
    if (e.key == ESCAPE && node_clicked_id != null) {
      nodeById.get(node_clicked_id).selected = false;
      node_clicked_id = null;
      redraw();
      none_button.disabled = true;
      red_button.disabled = true;
      black_button.disabled = true;
      none_button.checked = false;
      red_button.checked = false;
      black_button.checked = false;
      data_input.disabled = true;
      data_input.value = "";
    } else if (e.key == 'n') {
      addNode();
    } else if (e.key == 'd') {
      if (node_hover_id != null) {
        nodes = nodes.filter(d => d.id != node_hover_id);
        bst_edges = bst_edges.filter(d => d.parent.id != node_hover_id && d.child.id != node_hover_id);
        redraw();
        // console.log(node_hover_id, node_clicked_id);
        if (node_hover_id == node_clicked_id) {
          data_input.value = "";
          none_button.checked = false;
          red_button.checked = false;
          black_button.checked = false;
          data_input.disabled = true;
          none_button.disabled = true;
          red_button.disabled = true;
          black_button.disabled = true;
          node_clicked_id = null;
        }
        node_hover_id = null;
      } else if (edge_hover_id != null) {
        bst_edges = bst_edges.filter(d => d.id != edge_hover_id);
        redraw();
        edge_hover_id = null;
      }
    } else if (e.key == "Control") {
      if (node_hover_id != null) {

      }
    }
  })
  .on('mousemove', function (e) {
    [mouseX, mouseY] = d3.pointer(e);
  })
  .on("click", function(e) {
    console.log("body.onclick");
  });

function node_dblclick(event, d) {
  if (node_clicked_id != null) {
    nodeById.get(node_clicked_id).selected = false;
  }
  d.selected = true;

  node.selectAll(".nodeShape").attr("stroke-width", d => d.selected ? "4px" : "0px");

  node_clicked_id = d.id;

  data_input.value = d.label;
  none_button.checked = false;
  red_button.checked = false;
  black_button.checked = false;
  if (d.color == RED) {
    red_button.checked = true;
  } else if (d.color == BLACK) {
    black_button.checked = true;
  } else {
    none_button.checked = true;
  }
  none_button.disabled = false;
  red_button.disabled = false;
  black_button.disabled = false;
  data_input.disabled = false;
}

function node_onmouseover(event, d) {
  // console.log("In: ", d.label);
  d3.select(this).raise();
  node_hover_id = d.id;
}

function node_onmouseout(event, d) {
  // console.log("Out: ", d.label);
  node_hover_id = null;
}

function edge_onmouseover(event, d) {
  // console.log("In Edge: ", d);
  if (edge_hover_id != null) {
    edgeById.get(edge_hover_id).selected = false;
  }
  d.selected = true;

  edge_hover_id = d.id;
}

function edge_onmouseout(event, d) {
  // console.log("Out Edge: ", d);
  d.selected = false;
  edge_hover_id = null;
}


function dragstarted(event) {
  // if (!event.active) simulation.alphaTarget(0.3).restart();
  if (!event.active) simulation.alphaTarget(0.3).restart();
  event.subject.fx = event.subject.x;
  event.subject.fy = event.subject.y;
}

function dragged(event) {
  event.subject.fx = event.x;
  event.subject.fy = event.y;
}

function dragended(event) {
  // if (!event.active) simulation.alphaTarget(0);
  event.subject.fx = null;
  event.subject.fy = null;
}