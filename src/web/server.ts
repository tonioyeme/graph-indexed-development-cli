/**
 * GID Visual - Web Server
 *
 * Serves the graph visualization UI with D3.js
 */

import express from 'express';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ServerOptions {
  port: number;
  graphPath: string;
  openBrowser: boolean;
}

export function startServer(options: ServerOptions): void {
  const app = express();
  const { port, graphPath, openBrowser } = options;

  app.use(express.json());

  // Serve the visualization HTML
  app.get('/', (req, res) => {
    res.send(generateHTML());
  });

  // API: Get graph data
  app.get('/api/graph', (req, res) => {
    try {
      const content = readFileSync(graphPath, 'utf-8');
      const graph = yaml.load(content) as Record<string, unknown>;
      res.json(graph);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load graph' });
    }
  });

  // API: Get layout
  app.get('/api/layout', (req, res) => {
    const layoutPath = resolve(dirname(graphPath), 'layout.json');
    if (existsSync(layoutPath)) {
      const layout = JSON.parse(readFileSync(layoutPath, 'utf-8'));
      res.json(layout);
    } else {
      res.json({});
    }
  });

  // Start server
  const server = app.listen(port, () => {
    console.log();
    console.log(chalk.green('GID Visual started'));
    console.log(chalk.dim(`Graph: ${graphPath}`));
    console.log();
    console.log(`  ${chalk.cyan('Local:')}   http://localhost:${port}`);
    console.log();
    console.log(chalk.dim('Press Ctrl+C to stop'));
    console.log();

    if (openBrowser) {
      import('open').then((open) => {
        open.default(`http://localhost:${port}`);
      }).catch(() => {
        // open package not available, skip
      });
    }
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log(chalk.dim('\nShutting down...'));
    server.close();
    process.exit(0);
  });
}

function generateHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GID Visual - Graph Visualization</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      overflow: hidden;
    }
    #header {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 50px;
      background: #16213e;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      z-index: 100;
      border-bottom: 1px solid #0f3460;
    }
    #header h1 { font-size: 18px; font-weight: 500; color: #e94560; }
    #controls { display: flex; gap: 10px; align-items: center; }
    #controls input {
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid #0f3460;
      background: #1a1a2e;
      color: #eee;
      width: 200px;
    }
    #controls button {
      padding: 6px 12px;
      border-radius: 4px;
      border: none;
      background: #e94560;
      color: white;
      cursor: pointer;
    }
    #controls button:hover { background: #ff6b6b; }
    #graph { position: fixed; top: 50px; left: 0; right: 0; bottom: 50px; }
    #footer {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 50px;
      background: #16213e;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      border-top: 1px solid #0f3460;
      font-size: 14px;
      color: #888;
    }
    #footer .stat { margin-right: 20px; }
    #details {
      position: fixed;
      right: 20px; top: 70px;
      width: 300px;
      background: #16213e;
      border-radius: 8px;
      padding: 20px;
      display: none;
      border: 1px solid #0f3460;
    }
    #details.visible { display: block; }
    #details h3 { color: #e94560; margin-bottom: 10px; }
    #details .property { margin: 8px 0; }
    #details .property label { color: #888; font-size: 12px; display: block; }
    .node { cursor: pointer; }
    .node circle { stroke: #fff; stroke-width: 2px; }
    .node text { fill: #eee; font-size: 12px; pointer-events: none; }
    .link { stroke: #0f3460; stroke-opacity: 0.6; }
    .link.implements { stroke: #4caf50; }
    .link.depends_on { stroke: #2196f3; }
    .link.calls { stroke: #ff9800; }
    .link.reads { stroke: #9c27b0; }
    .link.writes { stroke: #f44336; }
    .legend {
      position: fixed;
      left: 20px; bottom: 70px;
      background: #16213e;
      padding: 15px;
      border-radius: 8px;
      font-size: 12px;
      border: 1px solid #0f3460;
    }
    .legend-item { display: flex; align-items: center; margin: 5px 0; }
    .legend-color { width: 20px; height: 3px; margin-right: 8px; }
  </style>
</head>
<body>
  <div id="header">
    <h1>GID Visual</h1>
    <div id="controls">
      <input type="text" id="search" placeholder="Search nodes...">
      <button onclick="resetZoom()">Reset View</button>
    </div>
  </div>

  <div id="graph"></div>

  <div id="details">
    <h3 id="node-name">Node</h3>
    <div id="node-properties"></div>
  </div>

  <div class="legend">
    <div class="legend-item"><div class="legend-color" style="background:#4caf50"></div>implements</div>
    <div class="legend-item"><div class="legend-color" style="background:#2196f3"></div>depends_on</div>
    <div class="legend-item"><div class="legend-color" style="background:#ff9800"></div>calls</div>
    <div class="legend-item"><div class="legend-color" style="background:#9c27b0"></div>reads</div>
    <div class="legend-item"><div class="legend-color" style="background:#f44336"></div>writes</div>
  </div>

  <div id="footer">
    <div>
      <span class="stat">Nodes: <span id="node-count">0</span></span>
      <span class="stat">Edges: <span id="edge-count">0</span></span>
    </div>
    <div>GID CLI - Free Version</div>
  </div>

  <script>
    let graphData = null;
    let simulation = null;
    let svg = null;
    let g = null;
    let zoom = null;

    const nodeColors = {
      Feature: '#e94560',
      Component: '#4caf50',
      Interface: '#ff9800',
      Data: '#9c27b0',
      File: '#607d8b',
      Test: '#00bcd4',
    };

    async function loadGraph() {
      const res = await fetch('/api/graph');
      graphData = await res.json();
      document.getElementById('node-count').textContent = Object.keys(graphData.nodes || {}).length;
      document.getElementById('edge-count').textContent = (graphData.edges || []).length;
      renderGraph();
    }

    function renderGraph() {
      const container = document.getElementById('graph');
      const width = container.clientWidth;
      const height = container.clientHeight;

      container.innerHTML = '';

      svg = d3.select('#graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

      zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => g.attr('transform', event.transform));

      svg.call(zoom);
      g = svg.append('g');

      const nodes = Object.entries(graphData.nodes || {}).map(([id, data]) => ({
        id, ...(data || {})
      }));

      const links = (graphData.edges || []).map((e) => ({
        source: e.from,
        target: e.to,
        relation: e.relation,
      }));

      simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(50));

      const link = g.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('class', d => 'link ' + d.relation)
        .attr('stroke-width', 2);

      const node = g.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .attr('class', 'node')
        .on('click', (event, d) => showDetails(d));

      node.append('circle')
        .attr('r', 20)
        .attr('fill', d => nodeColors[d.type] || '#607d8b');

      node.append('text')
        .text(d => d.id.length > 15 ? d.id.substring(0, 12) + '...' : d.id)
        .attr('text-anchor', 'middle')
        .attr('dy', 35);

      simulation.on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        node.attr('transform', d => \`translate(\${d.x},\${d.y})\`);
      });
    }

    function showDetails(node) {
      const details = document.getElementById('details');
      document.getElementById('node-name').textContent = node.id;
      const props = document.getElementById('node-properties');
      props.innerHTML = '';
      ['type', 'description', 'layer', 'path', 'status'].forEach(key => {
        if (node[key]) {
          props.innerHTML += \`<div class="property"><label>\${key}</label><div>\${node[key]}</div></div>\`;
        }
      });
      details.classList.add('visible');
    }

    function resetZoom() {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    }

    document.getElementById('search').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      d3.selectAll('.node').each(function(d) {
        const match = d.id.toLowerCase().includes(query);
        d3.select(this).style('opacity', query === '' ? 1 : (match ? 1 : 0.2));
      });
    });

    loadGraph();
  </script>
</body>
</html>`;
}
