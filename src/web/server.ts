/**
 * Web Server for Graph Visualization
 *
 * Serves the graph visualization UI and provides API endpoints.
 */

import express, { Request, Response } from 'express';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { loadGraph, GIDGraph, QueryEngine, Validator } from '../core/index.js';
import { Graph } from '../core/types.js';

export interface ServerOptions {
  port: number;
  graphPath?: string;
  open?: boolean;
}

export function createServer(options: ServerOptions): express.Application {
  const app = express();

  // Parse JSON bodies
  app.use(express.json());

  // ═══════════════════════════════════════════════════════════════════════════
  // API Endpoints
  // ═══════════════════════════════════════════════════════════════════════════

  // Get graph data
  app.get('/api/graph', (_req: Request, res: Response) => {
    try {
      const graphData = loadGraph(options.graphPath);
      const graph = new GIDGraph(graphData);

      // Transform to D3-friendly format
      const nodes = Array.from(graph.getNodes().entries()).map(([id, node]) => ({
        id,
        ...node,
      }));

      const links = graph.getEdges().map((edge) => ({
        source: edge.from,
        target: edge.to,
        relation: edge.relation,
      }));

      res.json({ nodes, links });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Get impact analysis
  app.get('/api/impact/:node', (req: Request, res: Response) => {
    try {
      const graphData = loadGraph(options.graphPath);
      const graph = new GIDGraph(graphData);
      const engine = new QueryEngine(graph);

      const result = engine.getImpact(req.params.node);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Get dependencies
  app.get('/api/deps/:node', (req: Request, res: Response) => {
    try {
      const graphData = loadGraph(options.graphPath);
      const graph = new GIDGraph(graphData);
      const engine = new QueryEngine(graph);

      const all = req.query.all === 'true';
      const result = engine.getDependencies(req.params.node, all);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Get validation results
  app.get('/api/validate', (_req: Request, res: Response) => {
    try {
      const graphData = loadGraph(options.graphPath);
      const graph = new GIDGraph(graphData);
      const validator = new Validator();

      const result = validator.validate(graph);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Search nodes
  app.get('/api/search', (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string || '').toLowerCase();
      const graphData = loadGraph(options.graphPath);
      const graph = new GIDGraph(graphData);

      const results = Array.from(graph.getNodes().entries())
        .filter(([id, node]) =>
          id.toLowerCase().includes(query) ||
          (node.description || '').toLowerCase().includes(query)
        )
        .map(([id, node]) => ({ id, ...node }))
        .slice(0, 20);

      res.json(results);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Static Files (embedded HTML/JS/CSS)
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/', (_req: Request, res: Response) => {
    res.send(getIndexHtml());
  });

  return app;
}

export function startServer(options: ServerOptions): void {
  const app = createServer(options);

  app.listen(options.port, () => {
    const url = `http://localhost:${options.port}`;
    console.log(`\nGID Visualization Server running at ${url}\n`);

    if (options.open) {
      // Try to open browser
      const open = process.platform === 'darwin' ? 'open' :
                   process.platform === 'win32' ? 'start' : 'xdg-open';
      import('node:child_process').then(({ exec }) => {
        exec(`${open} ${url}`);
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Embedded HTML
// ═══════════════════════════════════════════════════════════════════════════════

function getIndexHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GID Graph Visualization</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      overflow: hidden;
    }

    #app {
      display: flex;
      height: 100vh;
    }

    /* Sidebar */
    #sidebar {
      width: 320px;
      background: #16213e;
      padding: 20px;
      overflow-y: auto;
      border-right: 1px solid #0f3460;
    }

    #sidebar h1 {
      font-size: 1.4rem;
      margin-bottom: 20px;
      color: #e94560;
    }

    #search {
      width: 100%;
      padding: 10px;
      border: 1px solid #0f3460;
      border-radius: 4px;
      background: #1a1a2e;
      color: #eee;
      margin-bottom: 20px;
    }

    #search:focus {
      outline: none;
      border-color: #e94560;
    }

    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }

    .stat {
      background: #1a1a2e;
      padding: 12px;
      border-radius: 4px;
      text-align: center;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: #e94560;
    }

    .stat-label {
      font-size: 0.75rem;
      color: #888;
    }

    /* Node Details Panel */
    #details {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #0f3460;
    }

    #details h2 {
      font-size: 1rem;
      margin-bottom: 10px;
      color: #e94560;
    }

    #details .node-name {
      font-size: 1.2rem;
      font-weight: bold;
      margin-bottom: 10px;
    }

    #details .node-type {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-bottom: 10px;
    }

    #details .description {
      color: #aaa;
      font-size: 0.9rem;
      margin-bottom: 15px;
    }

    #details .deps-section {
      margin-top: 15px;
    }

    #details .deps-section h3 {
      font-size: 0.85rem;
      color: #888;
      margin-bottom: 5px;
    }

    #details .dep-item {
      padding: 5px 10px;
      background: #1a1a2e;
      border-radius: 4px;
      margin: 5px 0;
      cursor: pointer;
      font-size: 0.85rem;
    }

    #details .dep-item:hover {
      background: #0f3460;
    }

    /* Main Graph Area */
    #graph-container {
      flex: 1;
      position: relative;
    }

    #graph {
      width: 100%;
      height: 100%;
    }

    /* Tooltip */
    .tooltip {
      position: absolute;
      padding: 10px;
      background: #16213e;
      border: 1px solid #0f3460;
      border-radius: 4px;
      pointer-events: none;
      font-size: 0.85rem;
      max-width: 250px;
      z-index: 1000;
    }

    /* Legend */
    #legend {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: #16213e;
      padding: 15px;
      border-radius: 4px;
      border: 1px solid #0f3460;
    }

    #legend h3 {
      font-size: 0.8rem;
      color: #888;
      margin-bottom: 10px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      margin: 5px 0;
      font-size: 0.8rem;
    }

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
    }

    /* Controls */
    #controls {
      position: absolute;
      top: 20px;
      right: 20px;
      display: flex;
      gap: 10px;
    }

    #controls button {
      padding: 8px 16px;
      border: 1px solid #0f3460;
      border-radius: 4px;
      background: #16213e;
      color: #eee;
      cursor: pointer;
    }

    #controls button:hover {
      background: #0f3460;
    }

    /* Node colors by type */
    .node-Feature { fill: #e94560; }
    .node-Component { fill: #4ecca3; }
    .node-Interface { fill: #f9ed69; }
    .node-Data { fill: #6c5ce7; }
    .node-File { fill: #74b9ff; }
    .node-Test { fill: #fd79a8; }
    .node-Decision { fill: #ffeaa7; }

    /* Edge colors by relation */
    .edge-implements { stroke: #e94560; }
    .edge-depends_on { stroke: #4ecca3; }
    .edge-calls { stroke: #f9ed69; }
    .edge-tested_by { stroke: #fd79a8; }

    /* Health indicator */
    #health {
      margin-top: 20px;
      padding: 15px;
      background: #1a1a2e;
      border-radius: 4px;
    }

    #health-score {
      font-size: 2rem;
      font-weight: bold;
    }

    #health-label {
      font-size: 0.8rem;
      color: #888;
    }
  </style>
</head>
<body>
  <div id="app">
    <aside id="sidebar">
      <h1>GID Visualization</h1>

      <input type="text" id="search" placeholder="Search nodes...">

      <div class="stats">
        <div class="stat">
          <div class="stat-value" id="node-count">-</div>
          <div class="stat-label">Nodes</div>
        </div>
        <div class="stat">
          <div class="stat-value" id="edge-count">-</div>
          <div class="stat-label">Edges</div>
        </div>
      </div>

      <div id="health">
        <div id="health-score">-</div>
        <div id="health-label">Health Score</div>
      </div>

      <div id="details" style="display: none;">
        <h2>Selected Node</h2>
        <div class="node-name" id="detail-name"></div>
        <span class="node-type" id="detail-type"></span>
        <p class="description" id="detail-desc"></p>

        <div class="deps-section">
          <h3>Dependencies</h3>
          <div id="detail-deps"></div>
        </div>

        <div class="deps-section">
          <h3>Dependents</h3>
          <div id="detail-dependents"></div>
        </div>
      </div>
    </aside>

    <main id="graph-container">
      <svg id="graph"></svg>

      <div id="controls">
        <button onclick="resetZoom()">Reset Zoom</button>
        <button onclick="toggleLabels()">Toggle Labels</button>
      </div>

      <div id="legend">
        <h3>Node Types</h3>
        <div class="legend-item"><span class="legend-color" style="background:#e94560"></span> Feature</div>
        <div class="legend-item"><span class="legend-color" style="background:#4ecca3"></span> Component</div>
        <div class="legend-item"><span class="legend-color" style="background:#74b9ff"></span> File</div>
        <div class="legend-item"><span class="legend-color" style="background:#6c5ce7"></span> Data</div>
        <div class="legend-item"><span class="legend-color" style="background:#fd79a8"></span> Test</div>
      </div>

      <div class="tooltip" id="tooltip" style="display: none;"></div>
    </main>
  </div>

  <script>
    // ═══════════════════════════════════════════════════════════════════════════
    // Global State
    // ═══════════════════════════════════════════════════════════════════════════

    let graphData = { nodes: [], links: [] };
    let simulation;
    let svg, g, link, node, label;
    let showLabels = true;
    let selectedNode = null;

    const width = document.getElementById('graph-container').clientWidth;
    const height = document.getElementById('graph-container').clientHeight;

    // Node type colors
    const typeColors = {
      Feature: '#e94560',
      Component: '#4ecca3',
      Interface: '#f9ed69',
      Data: '#6c5ce7',
      File: '#74b9ff',
      Test: '#fd79a8',
      Decision: '#ffeaa7'
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // Initialize
    // ═══════════════════════════════════════════════════════════════════════════

    async function init() {
      // Load graph data
      const response = await fetch('/api/graph');
      graphData = await response.json();

      // Update stats
      document.getElementById('node-count').textContent = graphData.nodes.length;
      document.getElementById('edge-count').textContent = graphData.links.length;

      // Load health score
      const healthResponse = await fetch('/api/validate');
      const healthData = await healthResponse.json();
      const scoreEl = document.getElementById('health-score');
      scoreEl.textContent = healthData.healthScore + '/100';
      scoreEl.style.color = healthData.healthScore >= 80 ? '#4ecca3' :
                            healthData.healthScore >= 50 ? '#f9ed69' : '#e94560';

      // Create visualization
      createGraph();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // D3 Graph Visualization
    // ═══════════════════════════════════════════════════════════════════════════

    function createGraph() {
      svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

      // Add zoom behavior
      const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      svg.call(zoom);

      // Create container group
      g = svg.append('g');

      // Arrow marker for directed edges
      svg.append('defs').selectAll('marker')
        .data(['implements', 'depends_on', 'calls', 'tested_by'])
        .join('marker')
        .attr('id', d => 'arrow-' + d)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', d => d === 'implements' ? '#e94560' :
                          d === 'depends_on' ? '#4ecca3' :
                          d === 'calls' ? '#f9ed69' : '#fd79a8')
        .attr('d', 'M0,-5L10,0L0,5');

      // Create links
      link = g.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(graphData.links)
        .join('line')
        .attr('stroke', d => d.relation === 'implements' ? '#e94560' :
                            d.relation === 'depends_on' ? '#4ecca3' :
                            d.relation === 'calls' ? '#f9ed69' : '#fd79a8')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 1.5)
        .attr('marker-end', d => 'url(#arrow-' + d.relation + ')');

      // Create nodes
      node = g.append('g')
        .attr('class', 'nodes')
        .selectAll('circle')
        .data(graphData.nodes)
        .join('circle')
        .attr('r', d => d.type === 'Feature' ? 12 : 8)
        .attr('fill', d => typeColors[d.type] || '#888')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .call(drag())
        .on('click', selectNode)
        .on('mouseover', showTooltip)
        .on('mouseout', hideTooltip);

      // Create labels
      label = g.append('g')
        .attr('class', 'labels')
        .selectAll('text')
        .data(graphData.nodes)
        .join('text')
        .text(d => d.id.split('/').pop())
        .attr('font-size', 10)
        .attr('fill', '#fff')
        .attr('dx', 12)
        .attr('dy', 4);

      // Force simulation
      simulation = d3.forceSimulation(graphData.nodes)
        .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(80))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(30))
        .on('tick', ticked);

      // Store zoom for reset
      window.zoomBehavior = zoom;
    }

    function ticked() {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      label
        .attr('x', d => d.x)
        .attr('y', d => d.y);
    }

    function drag() {
      return d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Interactions
    // ═══════════════════════════════════════════════════════════════════════════

    function selectNode(event, d) {
      selectedNode = d;

      // Update visual selection
      node.attr('stroke', n => n.id === d.id ? '#fff' : '#fff')
          .attr('stroke-width', n => n.id === d.id ? 3 : 1.5);

      // Update details panel
      document.getElementById('details').style.display = 'block';
      document.getElementById('detail-name').textContent = d.id;
      document.getElementById('detail-type').textContent = d.type;
      document.getElementById('detail-type').style.background = typeColors[d.type] || '#888';
      document.getElementById('detail-desc').textContent = d.description || 'No description';

      // Load dependencies
      loadDependencies(d.id);
    }

    async function loadDependencies(nodeId) {
      try {
        const response = await fetch('/api/deps/' + encodeURIComponent(nodeId));
        const data = await response.json();

        const depsEl = document.getElementById('detail-deps');
        depsEl.innerHTML = data.direct.length > 0
          ? data.direct.map(d => '<div class="dep-item" onclick="focusNode(\\'' + d + '\\')">' + d + '</div>').join('')
          : '<div style="color:#666;font-size:0.8rem;">None</div>';

        const dependentsEl = document.getElementById('detail-dependents');
        dependentsEl.innerHTML = data.dependents && data.dependents.length > 0
          ? data.dependents.map(d => '<div class="dep-item" onclick="focusNode(\\'' + d + '\\')">' + d + '</div>').join('')
          : '<div style="color:#666;font-size:0.8rem;">None</div>';
      } catch (err) {
        console.error('Failed to load dependencies:', err);
      }
    }

    function focusNode(nodeId) {
      const nodeData = graphData.nodes.find(n => n.id === nodeId);
      if (nodeData) {
        selectNode(null, nodeData);

        // Center view on node
        svg.transition()
          .duration(750)
          .call(window.zoomBehavior.transform, d3.zoomIdentity
            .translate(width / 2 - nodeData.x, height / 2 - nodeData.y));
      }
    }

    function showTooltip(event, d) {
      const tooltip = document.getElementById('tooltip');
      tooltip.innerHTML = '<strong>' + d.id + '</strong><br>' +
                          '<span style="color:' + (typeColors[d.type] || '#888') + '">' + d.type + '</span><br>' +
                          (d.description || '');
      tooltip.style.display = 'block';
      tooltip.style.left = (event.pageX + 10) + 'px';
      tooltip.style.top = (event.pageY + 10) + 'px';
    }

    function hideTooltip() {
      document.getElementById('tooltip').style.display = 'none';
    }

    function resetZoom() {
      svg.transition()
        .duration(750)
        .call(window.zoomBehavior.transform, d3.zoomIdentity);
    }

    function toggleLabels() {
      showLabels = !showLabels;
      label.style('display', showLabels ? 'block' : 'none');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Search
    // ═══════════════════════════════════════════════════════════════════════════

    document.getElementById('search').addEventListener('input', async (e) => {
      const query = e.target.value.trim();

      if (query.length < 2) {
        // Reset highlight
        node.attr('opacity', 1);
        link.attr('opacity', 0.6);
        return;
      }

      // Highlight matching nodes
      const matches = graphData.nodes
        .filter(n => n.id.toLowerCase().includes(query.toLowerCase()) ||
                    (n.description || '').toLowerCase().includes(query.toLowerCase()))
        .map(n => n.id);

      node.attr('opacity', d => matches.includes(d.id) ? 1 : 0.2);
      link.attr('opacity', d =>
        matches.includes(d.source.id) || matches.includes(d.target.id) ? 0.6 : 0.1);
    });

    // Initialize on load
    init();
  </script>
</body>
</html>`;
}
