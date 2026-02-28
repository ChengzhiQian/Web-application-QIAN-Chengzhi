import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SparqlService, GameListItem } from '../../services/sparql.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css'
})
export class SearchComponent implements OnInit {
  q = '';
  limit = 20;
  offset = 0;
  total = 0;

  loading = false;
  error: string | null = null;
  items: GameListItem[] = [];

  constructor(private sparql: SparqlService) {}

  async ngOnInit() {
    await this.doSearch();
  }

  async doSearch(resetPage = true) {
    if (resetPage) this.offset = 0;
    this.loading = true;
    this.error = null;

    try {
      const [items, total] = await Promise.all([
        this.sparql.searchGames(this.q, this.limit, this.offset),
        this.sparql.countGames(this.q)
      ]);

      this.items = items;
      this.total = total;
    } catch (e: any) {
      this.error = String(e?.message ?? e);
      this.items = [];
      this.total = 0;
    } finally {
      this.loading = false;
    }
  }

  async nextPage() {
    this.offset += this.limit;
    await this.doSearch(false);
  }

  async prevPage() {
    this.offset = Math.max(0, this.offset - this.limit);
    await this.doSearch(false);
  }
}
