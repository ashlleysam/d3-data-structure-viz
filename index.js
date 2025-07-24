import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { SnackBar } from "./modules/js-snackbar.js";
import { BinaryTree } from "./binarytree.js";

const ESCAPE = "Escape";
const RED = "red";
const BLACK = "black"
const NONE = "none";
const RED_COLOR = "#C5050C"
const BLACK_COLOR = "rgba(0, 0, 0, 1)"
const COLOR_MAP = new Map([[RED, RED_COLOR], [BLACK, BLACK_COLOR], [NONE, "white"]]);
const TEXT_COLOR_MAP = new Map([[RED, "white"], [BLACK, "white"], [NONE, "black"]]);
const BORDER_COLOR_MAP = new Map([[RED, "black"], [BLACK, "white"], [NONE, "black"]]);
const RADIUS = 50;
const NODE_SEP_X = 110;
const NODE_SEP_Y = 130;
let container = null;
let node_selected_id = null;
let node_hover_id = null;
let edge_hover_id = null;
let edge_start_id = null;
let child_type = null;
let width = window.innerWidth
let height = window.innerHeight;
let context_menu = null;
let context_add_node = null;
let context_delete_node = null;
let context_edit_node = null;
let context_add_left_child = null;
let context_add_right_child = null;
let context_delete_edge = null;
let context_save_file = null;
let context_open_file = null;
let context_clear_all = null;
let ctx_menu_select_node_id = null;
let ctx_menu_select_edge_id = null;
let svg = null;
let tree = null;
let simulation = null;
let g_link, link, g_misc, draw_edge, g_node, node, circles, triangles, text = null;
let data_menu, data_input, none_button, red_button, black_button, circle_button, triangle_button = null;
let mouseX, mouseY = null;

async function saveFile(blob, suggestedName) {
  // Feature detection. The API needs to be supported
  // and the app not run in an iframe.
  const supportsFileSystemAccess =
    'showSaveFilePicker' in window &&
    (() => {
      try {
        return window.self === window.top;
      } catch {
        return false;
      }
    })();
  // If the File System Access API is supported…
  if (supportsFileSystemAccess) {
    try {
      // Show the file save dialog.
      const handle = await showSaveFilePicker({
        suggestedName,
      });
      // Write the blob to the file.
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      // Fail silently if the user has simply canceled the dialog.
      if (err.name !== 'AbortError') {
        console.error(err.name, err.message);
      }
      return;
    }
  }
  // Fallback if the File System Access API is not supported…
  // Create the blob URL.
  const blobURL = URL.createObjectURL(blob);
  // Create the `<a download>` element and append it invisibly.
  const a = document.createElement('a');
  a.href = blobURL;
  a.download = suggestedName;
  a.style.display = 'none';
  document.body.append(a);
  // Programmatically click the element.
  a.click();
  // Revoke the blob URL and remove the element.
  setTimeout(() => {
    URL.revokeObjectURL(blobURL);
    a.remove();
  }, 1000);
};

async function openFileOrFiles(multiple = false, types = null) {
  // Feature detection. The API needs to be supported
  // and the app not run in an iframe.
  const supportsFileSystemAccess =
    "showOpenFilePicker" in window &&
    (() => {
      try {
        return window.self === window.top;
      } catch {
        return false;
      }
    })();
  // If the File System Access API is supported…
  if (supportsFileSystemAccess) {
    let fileOrFiles = undefined;
    try {
      // Show the file picker, optionally allowing multiple files.
      const options = types ? { multiple: multiple, types: types } : { multiple: multiple };
      const handles = await showOpenFilePicker(options);
      // Only one file is requested.
      if (!multiple) {
        // Add the `FileSystemFileHandle` as `.handle`.
        fileOrFiles = await handles[0].getFile();
        fileOrFiles.handle = handles[0];
      } else {
        fileOrFiles = await Promise.all(
          handles.map(async (handle) => {
            const file = await handle.getFile();
            // Add the `FileSystemFileHandle` as `.handle`.
            file.handle = handle;
            return file;
          })
        );
      }
    } catch (err) {
      // Fail silently if the user has simply canceled the dialog.
      if (err.name !== 'AbortError') {
        console.error(err.name, err.message);
      }
    }
    return fileOrFiles;
  }
  // Fallback if the File System Access API is not supported.
  return new Promise((resolve) => {
    // Append a new `<input type="file" multiple? />` and hide it.
    const input = document.createElement('input');
    input.style.display = 'none';
    input.type = 'file';
    document.body.append(input);
    if (multiple) {
      input.multiple = true;
    }
    // The `change` event fires when the user interacts with the dialog.
    input.addEventListener('change', () => {
      // Remove the `<input type="file" multiple? />` again from the DOM.
      input.remove();
      // If no files were selected, return.
      if (!input.files) {
        return;
      }
      // Return all files or just one file.
      resolve(multiple ? Array.from(input.files) : input.files[0]);
    });
    // Show the picker.
    if ('showPicker' in HTMLInputElement.prototype) {
      input.showPicker();
    } else {
      input.click();
    }
  });
};

function degToRad(a) {
  return a * (Math.PI / 180);
}

function triangle_points(r) {
  let r1 = 1.5 * r;
  return `${r1 * Math.cos(degToRad(90))},${-r1 * Math.sin(degToRad(90))} ${r1 * Math.cos(degToRad(210))},${-r1 * Math.sin(degToRad(210))} ${r1 * Math.cos(degToRad(330))},${-r1 * Math.sin(degToRad(330))}`;
}

function redraw() {
  simulation
    .nodes(tree.nodes)
    .force("BST", forceBinaryTree(tree))
    .alphaTarget(0.3);

  const update_nodes = g_node.selectAll(".node").data(tree.nodes);

  node = update_nodes
    .enter()
    .append("g")
    .attr("class", "node")
    .on("mouseover", node_onmouseover)
    .on("mouseout", node_onmouseout)
    .on("dblclick", node_dblclick)
    .on("click", node_click)
    .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended))
    .merge(update_nodes);

  node.selectAll("*").remove();

  circles = node
    .filter(d => d.shape === "circle")
    .append("circle")
    .attr("class", "nodeShape")
    .attr("r", d => d.r)
    .style("fill", d => COLOR_MAP.get(d.color))
    .attr("stroke", d => BORDER_COLOR_MAP.get(d.color))
    .attr("stroke-width", d => d.selected ? "4px" : "1px")
    .merge(circles);

  triangles = node
    .filter(d => d.shape === "triangle")
    .append("polygon")
    .attr("class", "nodeShape")
    .attr("points", d => triangle_points(d.r))
    .style("fill", d => COLOR_MAP.get(d.color))
    .attr("stroke", d => BORDER_COLOR_MAP.get(d.color))
    .attr("stroke-width", d => d.selected ? "4px" : "1px")
    .merge(triangles);

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

  const update_links = g_link.selectAll(".link,.link-selected").data(tree.bst_edges);
  update_links.exit().remove();
  link = update_links
    .enter()
    .append("path")
    .attr("class", d => d.selected ? "link-selected" : "link")
    .on("mouseover", edge_onmouseover)
    .on("mouseout", edge_onmouseout)
    .merge(update_links);
}

function forceBinaryTree(tree, strength = 0.1) {
  // Apply a force to align the nodes into a binary tree
  function force(alpha) {
    tree.bst_edges.forEach(link => {
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

  return force;
}

function getTop(el) {
  // Find the top of an element relative to the window
  // https://stackoverflow.com/a/68805286
  return el.offsetTop + (el.offsetParent && getTop(el.offsetParent));
}

function getLeft(el) {
  // Find the left of an element relative to the window
  // https://stackoverflow.com/a/68805286
  return el.offsetLeft + (el.offsetParent && getLeft(el.offsetParent));
}

function showContextMenu(e) {
  context_menu.style = `width: 300px; left: ${mouseX}px; top: ${mouseY}px;`;
  context_add_node.style = node_hover_id == null && edge_hover_id == null ? "" : "display: none;";
  context_delete_node.style = node_hover_id == null ? "display: none;" : "";
  context_edit_node.style = node_hover_id == null ? "display: none;" : "";
  if (node_hover_id !== null) {
    let leftChild = new Map();
    let rightChild = new Map();
    tree.bst_edges.forEach(link => {
      (link.type == "left" ? leftChild : rightChild).set(link.parent.id, link.child.id);
    });
    context_add_left_child.style = leftChild.has(node_hover_id) ? "display: none;" : "";
    context_add_right_child.style = rightChild.has(node_hover_id) ? "display: none;" : "";
  } else {
    context_add_left_child.style = "display: none;";
    context_add_right_child.style = "display: none;";
  }

  if (node_hover_id == null && edge_hover_id !== null) {
    context_delete_edge.style = "";
    tree.getEdgeById(edge_hover_id).selected = true;
    link.attr("class", d => d.selected ? "link-selected" : "link");
  } else {
    context_delete_edge.style = "display: none;";
  }

  ctx_menu_select_node_id = node_hover_id;
  ctx_menu_select_edge_id = edge_hover_id;
}

function hideContextMenu() {
  context_menu.style = `width: 0px; left: 0px; top: 0px; display: none;`;
}

function drawChildLink(d) {
  return `M ${d.parent.x},${d.parent.y} Q${d.child.x},${d.parent.y} ${d.child.x},${d.child.y}`
}

function setSelectedColor(color) {
  return function () {
    if (node_selected_id == null) return;
    tree.getNodeById(node_selected_id).color = color;
    circles.style("fill", d => COLOR_MAP.get(d.color))
      .attr("stroke", d => BORDER_COLOR_MAP.get(d.color))
      .attr("stroke-width", d => d.selected ? "4px" : "1px");
    triangles.style("fill", d => COLOR_MAP.get(d.color))
      .attr("stroke", d => BORDER_COLOR_MAP.get(d.color))
      .attr("stroke-width", d => d.selected ? "4px" : "1px");
    text.attr("fill", d => TEXT_COLOR_MAP.get(d.color));
  };
}

function setSelectedShape(shape) {
  return function () {
    if (node_selected_id == null) return;
    tree.getNodeById(node_selected_id).shape = shape;
    redraw();
  };
}

function disable_edit_menu() {
  data_input.disabled = true;
  data_menu.style = "display: none;";
}

function enable_edit_menu() {
  data_input.disabled = false;
  data_menu.style = "position: absolute; left:5%; top:5%;";
}

function tick() {
  link.attr("d", d => drawChildLink(d))
  node.attr("transform", d => `translate(${d.x},${d.y})`);

  if (edge_start_id == null) {
    draw_edge.attr("d", "");
  } else {
    let edge_start = tree.getNodeById(edge_start_id);
    draw_edge.attr("d", `M ${edge_start.x},${edge_start.y} Q${mouseX},${edge_start.y} ${mouseX},${mouseY}`);
  }
}

function randIntRange(min, max) {
      min = Math.ceil(min);
      max = Math.floor(max);
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

function addNode() {
  const node = tree.addNode(mouseX, mouseY, RADIUS, NONE, "circle", randIntRange(1, 100));
  if (node_selected_id !== null) {
    tree.getNodeById(node_selected_id).selected = false;
  }
  node_selected_id = node.id;
  data_input.value = node.id;
  none_button.checked = true;
  red_button.checked = false;
  black_button.checked = false;
  none_button.disabled = false;
  red_button.disabled = false;
  black_button.disabled = false;
  circle_button.checked = true;
  triangle_button.checked = false;
  circle_button.disabled = false;
  triangle_button.disabled = false;
  enable_edit_menu();
  redraw();
}

function deleteNode(node_id) {
  tree.deleteNode(node_id);
  redraw();
  if (node_id == node_selected_id) {
    data_input.value = "";
    none_button.checked = false;
    red_button.checked = false;
    black_button.checked = false;
    disable_edit_menu();
    none_button.disabled = true;
    red_button.disabled = true;
    black_button.disabled = true;
    circle_button.disabled = true;
    triangle_button.disabled = true;
    node_selected_id = null;
  }
}

function deleteEdge(edge_id) {
  tree.deleteEdge(edge_id);
  redraw();
  link.attr("class", d => d.selected ? "link-selected" : "link");
}

function addEdge(parent_id, child_id, type) {
  try {
    tree.addEdge(parent_id, child_id, type);
  } catch (err) {
    SnackBar({
      message: err.message,
      dismissible: true,
      timeout: 5000,
      status: "error",
      container: "body",
      position: "tm"
    });
  }
  redraw();
}

function selectNode(node_id) {
  if (node_selected_id !== null) {
    tree.getNodeById(node_selected_id).selected = false;
  }
  let node_data = tree.getNodeById(node_id);
  node_data.selected = true;

  node.selectAll(".nodeShape").attr("stroke-width", d => d.selected ? "4px" : "1px");

  node_selected_id = node_id;

  data_input.value = node_data.label;
  none_button.checked = false;
  red_button.checked = false;
  black_button.checked = false;
  if (node_data.color == RED) {
    red_button.checked = true;
  } else if (node_data.color == BLACK) {
    black_button.checked = true;
  } else {
    none_button.checked = true;
  }
  if (node_data.shape == "circle") {
    circle_button.checked = true;
  } else {
    triangle_button.checked = true;
  }
  none_button.disabled = false;
  red_button.disabled = false;
  black_button.disabled = false;
  circle_button.disabled = false;
  triangle_button.disabled = false;
  enable_edit_menu();
}

function deselectNode() {
  if (node_selected_id == null) return;
  tree.getNodeById(node_selected_id).selected = false;
  node_selected_id = null;
  redraw();
  none_button.disabled = true;
  red_button.disabled = true;
  black_button.disabled = true;
  none_button.checked = false;
  red_button.checked = false;
  black_button.checked = false;
  disable_edit_menu();
}

function node_dblclick(event, d) {
  selectNode(d.id);
}

function node_click(event, d) {
  if (edge_start_id !== null) {
    addEdge(edge_start_id, d.id, child_type);
    edge_start_id = null;
    child_type = null;
    draw_edge.attr("d", "");
  }
}

function node_onmouseover(event, d) {
  d3.select(this).raise();
  node_hover_id = d.id;
}

function node_onmouseout(event, d) {
  node_hover_id = null;
}

function edge_onmouseover(event, d) {
  if (edge_hover_id !== null) {
    tree.getEdgeById(edge_hover_id).selected = false;
  }
  d.selected = true;

  edge_hover_id = d.id;
}

function edge_onmouseout(event, d) {
  d.selected = false;
  edge_hover_id = null;
}

function dragstarted(event) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  event.subject.fx = event.subject.x;
  event.subject.fy = event.subject.y;
}

function dragged(event) {
  event.subject.fx = event.x;
  event.subject.fy = event.y;
}

function dragended(event) {
  event.subject.fx = null;
  event.subject.fy = null;
}

function run() {
  container = document.getElementById("d3_container")
  context_menu = document.getElementById("contextMenu");
  context_add_node = document.getElementById("menu-item-add-node");
  context_delete_node = document.getElementById("menu-item-delete-node");
  context_edit_node = document.getElementById("menu-item-edit-node");
  context_add_left_child = document.getElementById("menu-item-add-left-child");
  context_add_right_child = document.getElementById("menu-item-add-right-child");
  context_delete_edge = document.getElementById("menu-item-delete-edge");
  context_save_file = document.getElementById("menu-item-save-file");
  context_open_file = document.getElementById("menu-item-open-file");
  context_clear_all = document.getElementById("menu-item-clear-all");
  width = window.innerWidth;
  height = window.innerHeight;

  context_add_node.onclick = function (e) {
    hideContextMenu();
    addNode();
  }

  context_delete_node.onclick = function (e) {
    hideContextMenu();
    if (ctx_menu_select_node_id !== null) {
      deleteNode(ctx_menu_select_node_id);
      ctx_menu_select_node_id = null;
    }
  }

  context_delete_node.onclick = function (e) {
    hideContextMenu();
    if (ctx_menu_select_node_id !== null) {
      deleteNode(ctx_menu_select_node_id);
      ctx_menu_select_node_id = null;
    }
  }

  context_delete_edge.onclick = function (e) {
    hideContextMenu();

    if (ctx_menu_select_edge_id !== null) {
      deleteEdge(ctx_menu_select_edge_id);
      ctx_menu_select_edge_id = null;
    }
  }


  context_edit_node.onclick = function (e) {
    hideContextMenu();
    if (ctx_menu_select_node_id !== null) {
      selectNode(ctx_menu_select_node_id);
      ctx_menu_select_node_id = null;
    }
  }

  context_add_left_child.onclick = function (e) {
    hideContextMenu();
    if (ctx_menu_select_node_id !== null) {
      edge_start_id = ctx_menu_select_node_id;
      child_type = "left";
    }
  }

  context_add_right_child.onclick = function (e) {
    hideContextMenu();
    if (ctx_menu_select_node_id !== null) {
      edge_start_id = ctx_menu_select_node_id;
      child_type = "right";
    }
  }

  context_save_file.onclick = async (e) => {
    hideContextMenu();
    const jsonString = tree.stringify();
    const blob = new Blob([jsonString], { type: 'text/plain' });
    saveFile(blob, "binary_tree.json");
  }

  context_open_file.onclick = async (e) => {
    hideContextMenu();
    const types = [
      {
        description: "JSON Files",
        accept: {
          "application/json": [".json"],
        },
      },
      {
        description: "Text Files",
        accept: {
          "text/plain": [".txt"],
        },
      },
    ];
    const file = await openFileOrFiles(false, types);
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result;
      try {
        const load_tree = BinaryTree.fromString(res);
        tree = load_tree;
        redraw();
      } catch (error) {
        alert("Malformed file. Please try again.");
      }
    };
    reader.onerror = () => {
      alert("Error reading the file. Please try again.");
    };
    reader.readAsText(file);
  }

  context_clear_all.onclick = function(e) {
    tree.clearAll();
    redraw();
  }

  svg = d3.select("#d3_container")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .on("contextmenu", function (e) {
      showContextMenu(e);
      e.preventDefault();
    });

  tree = new BinaryTree([
    { id: 0, x: 0, y: 0, r: RADIUS, label: "0", color: RED, selected: false, shape: "circle" },
    { id: 1, x: 0, y: 0, r: RADIUS, label: "1", color: BLACK, selected: false, shape: "circle" },
    { id: 2, x: 380, y: 100, r: RADIUS, label: "2", color: NONE, selected: false, shape: "circle" },
    { id: 3, x: 0, y: 0, r: RADIUS, label: "3", color: NONE, selected: false, shape: "circle" },
    { id: 4, x: 380, y: 100, r: RADIUS, label: "4", color: "black", selected: false, shape: "circle" },
    { id: 5, x: 380, y: 100, r: RADIUS, label: "5", color: RED, selected: false, shape: "circle" },
    { id: 6, x: 380, y: 100, r: RADIUS, label: "6", color: "black", selected: false, shape: "circle" },
    { id: 7, x: 380, y: 100, r: RADIUS, label: "7", color: "black", selected: false, shape: "circle" },
  ],
    [
      { id: 0, parent: 1, child: 0, type: "left", selected: false },
      { id: 1, parent: 1, child: 3, type: "right", selected: false },
      { id: 2, parent: 3, child: 4, type: "right", selected: false },
      { id: 3, parent: 3, child: 2, type: "left", selected: false },
      { id: 4, parent: 0, child: 5, type: "right", selected: false },
      { id: 5, parent: 2, child: 6, type: "left", selected: false },
      { id: 6, parent: 5, child: 7, type: "right", selected: false },
    ],
    NODE_SEP_X);

  simulation = d3
    .forceSimulation(tree.nodes)
    .alphaTarget(0.3)
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide(d => d.r))
    .force("BST", forceBinaryTree(tree))
    .on("tick", tick);

  window.onresize = function () {
    width = window.innerWidth;
    height = window.innerHeight;
    svg.attr("width", width).attr("height", height);
    simulation.force("center", d3.forceCenter(width / 2, height / 2));
  }

  g_link = svg.append("g").attr("class", "links");
  link = g_link
    .selectAll(".link,.link-selected")
    .data(tree.bst_edges)
    .enter()
    .append("path")
    .attr("class", d => d.selected ? "link-selected" : "link")
    .on("mouseover", edge_onmouseover)
    .on("mouseout", edge_onmouseout);

  g_misc = svg.append("g").attr("class", "misc");
  draw_edge = g_misc.append("path").attr("class", "link-no-hover");

  g_node = svg.append("g").attr("class", "nodes");
  node = g_node
    .selectAll(".node")
    .data(tree.nodes)
    .enter()
    .append("g")
    .attr("class", "node")
    .on("mouseover", node_onmouseover)
    .on("mouseout", node_onmouseout)
    .on("dblclick", node_dblclick)
    .on("click", node_click)
    .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

  circles = node
    .filter(d => d.shape === "circle")
    .append("circle")
    .attr("class", "nodeShape")
    .attr("r", d => d.r)
    .style("fill", d => COLOR_MAP.get(d.color))
    .attr("stroke", d => BORDER_COLOR_MAP.get(d.color))
    .attr("stroke-width", d => d.selected ? "4px" : "1px");


  triangles = node
    .filter(d => d.shape === "triangle")
    .append("polygon")
    .attr("class", "nodeShape")
    .attr("points", d => triangle_points(d.r))
    .style("fill", d => COLOR_MAP.get(d.color))
    .attr("stroke", d => BORDER_COLOR_MAP.get(d.color))
    .attr("stroke-width", d => d.selected ? "4px" : "1px");

  text = node
    .append("text")
    .attr("class", "nodeText")
    .text(d => d.label)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .attr("font-size", "2.5em")
    .attr("font-family", "sans-serif")
    .attr("fill", d => TEXT_COLOR_MAP.get(d.color));

  data_menu = document.getElementById("input_container");
  data_input = document.getElementById("nodeData");
  disable_edit_menu();
  data_input.oninput = function (ev) {
    if (node_selected_id == null) return;
    tree.getNodeById(node_selected_id).label = data_input.value;
    text.text(d => d.label);
  };
  data_input.value = "";
  none_button = document.getElementById("noneButton");
  none_button.onclick = setSelectedColor(NONE);
  red_button = document.getElementById("redButton");
  red_button.onclick = setSelectedColor(RED);
  black_button = document.getElementById("blackButton");
  black_button.onclick = setSelectedColor(BLACK);
  none_button.checked = false;
  red_button.checked = false;
  black_button.checked = false;
  none_button.disabled = true;
  red_button.disabled = true;
  black_button.disabled = true;

  circle_button = document.getElementById("circleButton");
  circle_button.onclick = setSelectedShape("circle");
  triangle_button = document.getElementById("triangleButton");
  triangle_button.onclick = setSelectedShape("triangle");
  circle_button.checked = false;
  triangle_button.checked = false;
  circle_button.disabled = true;
  triangle_button.disabled = true;

  d3.select("#data_playground")
    .on("keydown", function (e) {
      if (e.key == ESCAPE) {
        deselectNode();
      } else if (e.key == 'n') {
        addNode();
      } else if (e.key == 'd') {
        if (node_hover_id !== null) {
          deleteNode(node_hover_id);
          node_hover_id = null;
        } else if (edge_hover_id !== null) {
          deleteEdge(edge_hover_id);
          edge_hover_id = null;
        }
      } else if (e.key == 'ArrowRight') {
        if (node_selected_id !== null) {
          const right_child = tree.rightChild.has(node_selected_id) ? tree.rightChild.get(node_selected_id) : null;
          if (right_child !== null) {
            selectNode(right_child);
          }
        }
      } else if (e.key == 'ArrowLeft') {
        if (node_selected_id !== null) {
          const left_child = tree.leftChild.has(node_selected_id) ? tree.leftChild.get(node_selected_id) : null;
          if (left_child !== null) {
            selectNode(left_child);
          }
        }
      } else if (e.key == 'ArrowUp') {
        if (node_selected_id !== null) {
          const parent = tree.parent.has(node_selected_id) ? tree.parent.get(node_selected_id) : null;
          if (parent !== null) {
            selectNode(parent);
          }
        }
      }
    })
    .on('mousemove', function (e) {
      [mouseX, mouseY] = d3.pointer(e);
    })
    .on("click", function (e) {
      // This event is triggered for Safari on right clicks
      // as well as contextmenu, so we need to intercept it
      if (e.ctrlKey) return;

      // Always hide the context menu on the next click
      hideContextMenu();

      // If there is a selected node, deselect it if the click isn't on either
      // the data menu, the edit context menu, or on the node itself
      if (!data_menu.contains(e.target) && !context_edit_node.contains(e.target) && node_selected_id !== null) {
        const sel_node = node.filter(d => d.id === node_selected_id).nodes()[0];
        if (!sel_node.contains(e.target)) {
          deselectNode();
        }
      }

      if (!data_menu.contains(e.target) && ctx_menu_select_edge_id !== null) {
        tree.getEdgeById(ctx_menu_select_edge_id).selected = false;
        link.attr("class", d => d.selected ? "link-selected" : "link");
        ctx_menu_select_edge_id = null;
      }

      if (!context_add_left_child.contains(e.target) && !context_add_right_child.contains(e.target)) {
        edge_start_id = null;
        child_type = null;
        draw_edge.attr("d", "");
      }
    });
}

run();