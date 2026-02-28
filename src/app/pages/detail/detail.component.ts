import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SparqlService, GameDetail, RecommendationItem } from '../../services/sparql.service';

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './detail.component.html',
  styleUrl: './detail.component.css'
})
export class DetailComponent implements OnInit {
  loading = false;
  error: string | null = null;

  appid!: number;
  detail: GameDetail | null = null;
  recos: RecommendationItem[] = [];

  constructor(private route: ActivatedRoute, private sparql: SparqlService) {}

  async ngOnInit() {
    const idStr = this.route.snapshot.paramMap.get('appid') ?? '';
    const id = Number.parseInt(idStr, 10);
    this.appid = Number.isFinite(id) ? id : -1;

    await this.load();
  }

  async load() {
    if (this.appid < 0) {
      this.error = 'Invalid appid in route.';
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      this.detail = await this.sparql.getGameDetail(this.appid);
      this.recos = await this.sparql.recommendBySharedGenres(this.appid, 12);
    } catch (e: any) {
      this.error = String(e?.message ?? e);
      this.detail = null;
      this.recos = [];
    } finally {
      this.loading = false;
    }
  }
}
