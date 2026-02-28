import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type SparqlBindingValue = {
  type: string;
  value: string;
  datatype?: string;
  'xml:lang'?: string;
};

export type SparqlBindings = Record<string, SparqlBindingValue>;

export type SparqlJson = {
  head: { vars: string[] };
  results: { bindings: SparqlBindings[] };
};

export type GameListItem = {
  appid: number;
  label: string;
  discount?: number | null;
  price?: number | null;
  img?: string | null;
};

export type GameDetail = {
  appid: number;
  label: string;
  price?: number | null;
  discount?: number | null;
  dlc?: number | null;
  owners?: string | null;
  peak?: number | null;
  age?: number | null;
  userScore?: number | null;
  img?: string | null;
  discription?: string | null;
  genres?: string | null;
  developers?: string | null;
  publishers?: string | null;
  langs?: string | null;
};

export type GenreStat = { genre: string; n: number };

export type RecommendationItem = {
  appid: number;
  label: string;
  sharedGenres: number;
};

@Injectable({ providedIn: 'root' })
export class SparqlService {
  private readonly endpoint = '/fuseki/steam/query';

  constructor(private http: HttpClient) {}

  private prefixes(): string {
    return `
PREFIX :       <http://steam.com/>
PREFIX owl:    <http://www.w3.org/2002/07/owl#>
PREFIX rdf:    <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs:   <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
PREFIX vcard:  <http://www.w3.org/2006/vcard/ns#>
PREFIX xsd:    <http://www.w3.org/2001/XMLSchema#>
`.trim();
  }

  private async run(query: string): Promise<SparqlJson> {
    const params = new HttpParams()
      .set('query', query)
      .set('format', 'application/sparql-results+json');

    const headers = new HttpHeaders({
      Accept: 'application/sparql-results+json'
    });

    return await firstValueFrom(this.http.get<SparqlJson>(this.endpoint, { params, headers }));
  }

  private getStr(row: SparqlBindings, key: string): string | null {
    const v = row[key]?.value;
    return v ?? null;
  }

  private getInt(row: SparqlBindings, key: string): number | null {
    const s = this.getStr(row, key);
    if (s == null) return null;
    const n = Number.parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  }

  private getDouble(row: SparqlBindings, key: string): number | null {
    const s = this.getStr(row, key);
    if (s == null) return null;
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }

  // ---------- Public APIs for pages ----------

  async countGames(keyword: string): Promise<number> {
  const safe = (keyword ?? '').replaceAll('"', '\\"');

  const q = `
  ${this.prefixes()}

  SELECT (COUNT(DISTINCT ?g) AS ?total)
  WHERE {
    ?g a schema:VideoGame ;
      rdfs:label ?label .
    FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${safe}")))
  }
  `.trim();

    const json = await this.run(q);
    const b = json.results.bindings[0];
    const s = b?.['total']?.value;
    const n = s ? Number.parseInt(s, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  }


  async searchGames(keyword: string, limit = 20, offset = 0): Promise<GameListItem[]> {
    const safe = (keyword ?? '').replaceAll('"', '\\"');

    const q = `
  ${this.prefixes()}

  SELECT ?g ?appid ?label ?img ?price ?discount
  WHERE {
    ?g :appid ?appid ;
      rdfs:label ?label .

    OPTIONAL { ?g :header_image ?img }
    OPTIONAL { ?g schema:price ?price }
    OPTIONAL { ?g :discount ?discount }

    FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${safe}")))
  }
  ORDER BY LCASE(STR(?label))
  LIMIT ${limit} OFFSET ${offset}

  `.trim();

    const json = await this.run(q);
    return json.results.bindings.map((b) => ({
      appid: this.getInt(b, 'appid') ?? -1,
      label: this.getStr(b, 'label') ?? '',
      img: this.getStr(b, 'img'),
      price: this.getDouble(b, 'price'),
      discount: this.getInt(b, 'discount')
    })).filter(x => x.appid !== -1);
  }

  async getGameDetail(appid: number): Promise<GameDetail | null> {
    const q = `
    ${this.prefixes()}

    SELECT ?label ?appid ?price ?discount ?dlc ?owners ?peak ?age ?userScore ?img ?discription
          (GROUP_CONCAT(DISTINCT ?genreName; separator=" | ") AS ?genres)
          (GROUP_CONCAT(DISTINCT ?devName; separator=" | ") AS ?developers)
          (GROUP_CONCAT(DISTINCT ?pubName; separator=" | ") AS ?publishers)
          (GROUP_CONCAT(DISTINCT ?langName; separator=" | ") AS ?langs)
    WHERE {
      ?g a schema:VideoGame ;
        :appid ?appid ;
        rdfs:label ?label .

      FILTER(STR(?appid) = "${appid}")

      OPTIONAL { ?g schema:price ?price }
      OPTIONAL { ?g :discount ?discount }
      OPTIONAL { ?g :dlc_count ?dlc }
      OPTIONAL { ?g :estimated_owners ?owners }
      OPTIONAL { ?g :peak_ccu ?peak }
      OPTIONAL { ?g :required_age ?age }
      OPTIONAL { ?g :user_score ?userScore }
      OPTIONAL { ?g :header_image ?img }
      OPTIONAL { ?g schema:description ?discription }

      # genres as resources
      OPTIONAL {
        ?g :genres ?genre .
        OPTIONAL { ?genre schema:name ?gn1 }
        OPTIONAL { ?genre rdfs:label ?gn2 }
        BIND(COALESCE(?gn1, ?gn2, STRAFTER(STR(?genre), STR(:))) AS ?genreName)
      }

      # developers as resources
      OPTIONAL {
        ?g :developers ?dev .
        OPTIONAL { ?dev schema:name ?dn1 }
        OPTIONAL { ?dev rdfs:label ?dn2 }
        BIND(COALESCE(?dn1, ?dn2, STRAFTER(STR(?dev), STR(:))) AS ?devName)
      }

      # publishers as resources
      OPTIONAL {
        ?g :publishers ?pub .
        OPTIONAL { ?pub schema:name ?pn1 }
        OPTIONAL { ?pub rdfs:label ?pn2 }
        BIND(COALESCE(?pn1, ?pn2, STRAFTER(STR(?pub), STR(:))) AS ?pubName)
      }

      # supported languages as resources
      OPTIONAL {
        ?g :supported_languages ?lang .
        OPTIONAL { ?lang schema:name ?ln1 }
        OPTIONAL { ?lang rdfs:label ?ln2 }
        BIND(COALESCE(?ln1, ?ln2, STRAFTER(STR(?lang), STR(:))) AS ?langName)
      }
    }
    GROUP BY ?label ?appid ?price ?discount ?dlc ?owners ?peak ?age ?userScore ?img ?discription
    `.trim();

    const json = await this.run(q);
    const b = json.results.bindings[0];
    if (!b) return null;

    return {
      appid: this.getInt(b, 'appid') ?? appid,
      label: this.getStr(b, 'label') ?? '',
      price: this.getDouble(b, 'price'),
      discount: this.getInt(b, 'discount'),
      dlc: this.getInt(b, 'dlc'),
      owners: this.getStr(b, 'owners'),
      peak: this.getInt(b, 'peak'),
      age: this.getInt(b, 'age'),
      userScore: this.getInt(b, 'userScore'),
      img: this.getStr(b, 'img'),
      discription: this.getStr(b, 'discription'),
      genres: this.getStr(b, 'genres'),
      developers: this.getStr(b, 'developers'),
      publishers: this.getStr(b, 'publishers'),
      langs: this.getStr(b, 'langs')
    };
  }

  async topGenres(limit = 20): Promise<GenreStat[]> {
    const q = `
    ${this.prefixes()}

    SELECT (SAMPLE(?rawName) AS ?genreName) (COUNT(DISTINCT ?g) AS ?n)
    WHERE {
      ?g a schema:VideoGame ;
        :genres ?genre .

      OPTIONAL { ?genre schema:name ?gn1 }
      OPTIONAL { ?genre rdfs:label ?gn2 }

      BIND(COALESCE(?gn1, ?gn2, STRAFTER(STR(?genre), STR(:))) AS ?rawName)

      BIND(LCASE(STR(?rawName)) AS ?key)
    }
    GROUP BY ?key
    ORDER BY DESC(?n)
    LIMIT ${limit}
    `.trim();

    const json = await this.run(q);
    return json.results.bindings
      .map((b) => ({
        genre: this.getStr(b, 'genreName') ?? '',
        n: this.getInt(b, 'n') ?? 0
      }))
      .filter((x) => x.genre.length > 0);
  }

  async recommendBySharedGenres(appid: number, limit = 12): Promise<RecommendationItem[]> {
    const q = `
    ${this.prefixes()}

    SELECT ?appid ?label (COUNT(DISTINCT ?genre) AS ?sharedGenres)
    WHERE {
      ?g a schema:VideoGame ; :appid ${appid} ; :genres ?genre .
      ?other a schema:VideoGame ; :genres ?genre ; :appid ?appid ; rdfs:label ?label .
      FILTER(?other != ?g)
    }
    GROUP BY ?appid ?label
    ORDER BY DESC(?sharedGenres) LCASE(STR(?label))
    LIMIT ${limit}
    `.trim();

    const json = await this.run(q);
    return json.results.bindings.map((b) => ({
      appid: this.getInt(b, 'appid') ?? -1,
      label: this.getStr(b, 'label') ?? '',
      sharedGenres: this.getInt(b, 'sharedGenres') ?? 0
    })).filter(x => x.appid !== -1);
  }
}
