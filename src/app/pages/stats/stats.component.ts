import { Component, OnInit, ElementRef, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SparqlService, GenreStat } from '../../services/sparql.service';
import * as d3 from 'd3';

type ChartType = 'bar' | 'pie';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css'
})
export class StatsComponent implements OnInit {
  loading = false;
  error: string | null = null;

  genres: GenreStat[] = [];

  chartType: ChartType = 'bar';

  @ViewChild('genreChart', { static: true }) genreChart!: ElementRef<SVGSVGElement>;

  constructor(private sparql: SparqlService) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading = true;
    this.error = null;

    try {
      this.genres = await this.sparql.topGenres(20);
      this.render();
    } catch (e: any) {
      this.error = String(e?.message ?? e);
      this.genres = [];
      this.clearChart();
    } finally {
      this.loading = false;
    }
  }

  setChartType(t: ChartType) {
    this.chartType = t;
    this.render();
  }

  private render() {
    if (!this.genreChart) return;
    if (!this.genres || this.genres.length === 0) {
      this.clearChart();
      return;
    }

    if (this.chartType === 'bar') this.renderBar(this.genres);
    else this.renderPie(this.genres);
  }

  private clearChart() {
    if (!this.genreChart) return;
    d3.select(this.genreChart.nativeElement).selectAll('*').remove();
  }

  private renderBar(data: GenreStat[]) {
    const el = this.genreChart.nativeElement;
    d3.select(el).selectAll('*').remove();

    const margin = { top: 10, right: 30, bottom: 36, left: 190 };
    const width = 980;
    const barH = 26;
    const height = margin.top + margin.bottom + data.length * barH;

    const svg = d3.select(el).attr('width', width).attr('height', height);

    const color = d3
      .scaleOrdinal<string, string>()
      .domain(data.map(d => d.genre))
      .range(d3.schemeTableau10);

    const x = d3
      .scaleLinear()
      .domain([0, d3.max(data, d => d.n) ?? 0])
      .nice()
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleBand<string>()
      .domain(data.map(d => d.genre))
      .range([margin.top, height - margin.bottom])
      .padding(0.25);

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickSize(-(height - margin.top - margin.bottom)).tickFormat(() => ''))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('line').attr('stroke-opacity', 0.12));

    const bars = svg.append('g')
      .selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', x(0))
      .attr('y', d => y(d.genre)!)
      .attr('height', y.bandwidth())
      .attr('width', d => x(d.n) - x(0))
      .attr('fill', d => color(d.genre));

    bars.append('title').text(d => `${d.genre}: ${d.n}`);

    bars
      .on('mouseenter', function () {
        d3.select(this).attr('opacity', 0.8);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 1);
      });

    svg.append('g')
      .selectAll('text.value')
      .data(data)
      .join('text')
      .attr('class', 'value')
      .attr('x', d => x(d.n) + 8)
      .attr('y', d => y(d.genre)! + y.bandwidth() / 2)
      .attr('dominant-baseline', 'middle')
      .text(d => d3.format(',')(d.n));

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickSizeOuter(0));

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickSizeOuter(0));
  }


  private renderPie(data: GenreStat[]) {
    const el = this.genreChart.nativeElement;
    d3.select(el).selectAll('*').remove();

    const topN = 10;
    const sorted = [...data].sort((a, b) => b.n - a.n);
    const head = sorted.slice(0, topN);
    const rest = sorted.slice(topN);
    const others = rest.reduce((s, x) => s + x.n, 0);
    const pieData: GenreStat[] = others > 0 ? [...head, { genre: 'Others', n: others }] : head;

    const width = 980;
    const height = 520;
    const radius = Math.min(width * 0.55, height) / 2 - 10;

    const svg = d3.select(el).attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${width * 0.32},${height / 2})`);

    const color = d3
      .scaleOrdinal<string, string>()
      .domain(pieData.map(d => d.genre))
      .range(d3.schemeTableau10);

    const pie = d3.pie<GenreStat>().value(d => d.n).sort(null);
    const arcs = pie(pieData);

    const arc = d3.arc<d3.PieArcDatum<GenreStat>>()
      .innerRadius(Math.max(0, radius * 0.45))
      .outerRadius(radius);

    g.selectAll('path')
      .data(arcs)
      .join('path')
      .attr('d', arc as any)
      .attr('fill', d => color(d.data.genre))
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .append('title')
      .text(d => `${d.data.genre}: ${d3.format(',')(d.data.n)}`);

    const total = pieData.reduce((s, d) => s + d.n, 0);
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .text(`Total: ${d3.format(',')(total)}`);

    const legend = svg.append('g').attr('transform', `translate(${width * 0.62}, 70)`);

    const item = legend.selectAll('g')
      .data(pieData)
      .join('g')
      .attr('transform', (_, i) => `translate(0, ${i * 26})`);

    item.append('rect')
      .attr('width', 14)
      .attr('height', 14)
      .attr('y', -11)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('fill', d => color(d.genre));

    item.append('text')
      .attr('x', 20)
      .attr('y', 0)
      .attr('dominant-baseline', 'middle')
      .text(d => `${d.genre} (${d3.format(',')(d.n)})`);
  }

}
