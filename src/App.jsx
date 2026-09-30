import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileText,
  ImageOff,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import "./App.css";
import "./print.css";

const API = import.meta.env.VITE_API_URL,
  SIZE = 100;
const sort = new Intl.Collator("pt-BR", { sensitivity: "base" }).compare;
const values = (items, key, dept = "", section = "") =>
  [
    ...new Set(
      items
        .filter(
          (p) =>
            (!dept || p.DEPARTAMENTO === dept) &&
            (!section || p.CATEGORIA === section),
        )
        .map((p) => p[key])
        .filter(Boolean),
    ),
  ].sort(sort);
function grouped(items) {
  const map = new Map();
  items.forEach((p) => {
    const d = p.DEPARTAMENTO || "Outros",
      s = p.CATEGORIA || "Sem seção",
      b = p.MARCA || "Sem marca";
    if (!map.has(d)) map.set(d, new Map());
    const sm = map.get(d);
    if (!sm.has(s)) sm.set(s, new Map());
    const bm = sm.get(s);
    if (!bm.has(b)) bm.set(b, []);
    bm.get(b).push(p);
  });
  return [...map]
    .sort(([a], [b]) => sort(a, b))
    .map(([department, sections]) => ({
      department,
      sections: [...sections]
        .sort(([a], [b]) => sort(a, b))
        .map(([section, brands]) => ({
          section,
          brands: [...brands]
            .sort(([a], [b]) => sort(a, b))
            .map(([brand, products]) => ({
              brand,
              products: products.sort((a, b) =>
                sort(a.DESCRICAO || "", b.DESCRICAO || ""),
              ),
            })),
        })),
    }));
}
function App() {
  const [products, setProducts] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [department, setDepartment] = useState(""),
    [section, setSection] = useState(""),
    [brand, setBrand] = useState(""),
    [badImages, setBadImages] = useState(() => new Set());
  async function loadCatalog() {
    setLoading(true);
    setError("");
    setBadImages(new Set());
    try {
      const response = await fetch(`${API}/catalog?page=1&page_size=${SIZE}`);
      if (!response.ok) throw Error("Não foi possível acessar o catálogo.");
      const first = await response.json(),
        pages = Math.ceil((first.total || first.produtos?.length || 0) / SIZE);
      const others = await Promise.all(
        Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
          fetch(`${API}/catalog?page=${i + 2}&page_size=${SIZE}`).then(
            async (r) => {
              if (!r.ok)
                throw Error(
                  "Não foi possível carregar todas as páginas do catálogo.",
                );
              return r.json();
            },
          ),
        ),
      );
      setProducts([
        ...(first.produtos || []),
        ...others.flatMap((p) => p.produtos || []),
      ]);
    } catch (e) {
      setError(e.message || "O catálogo não pôde ser carregado.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadCatalog();
  }, []);
  const departments = useMemo(
      () => values(products, "DEPARTAMENTO"),
      [products],
    ),
    sections = useMemo(
      () => values(products, "CATEGORIA", department),
      [products, department],
    ),
    brands = useMemo(
      () => values(products, "MARCA", department, section),
      [products, department, section],
    );
  const visible = useMemo(
    () =>
      products.filter((p) => {
        const term = search.trim().toLocaleLowerCase("pt-BR");
        return (
          (!department || p.DEPARTAMENTO === department) &&
          (!section || p.CATEGORIA === section) &&
          (!brand || p.MARCA === brand) &&
          (!term ||
            `${p.DESCRICAO} ${p.MARCA}`
              .toLocaleLowerCase("pt-BR")
              .includes(term)) &&
          p.IMAGEM &&
          !badImages.has(p.CODPROD)
        );
      }),
    [products, search, department, section, brand, badImages],
  );
  const catalog = useMemo(() => grouped(visible), [visible]),
    invalidate = (code) =>
      setBadImages((current) => new Set(current).add(code));
  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark">DR</span>
          <div>
            <strong>Distribuidora Riograndense</strong>
            <span>Gerador de catálogo</span>
          </div>
        </div>
        <a
          href="https://distribuidorariograndense.com.br"
          target="_blank"
          rel="noreferrer"
        >
          Visitar site
        </a>
      </header>
      <section className="hero-panel no-print">
        <div>
          <p className="eyebrow">CATÁLOGO DE PRODUTOS</p>
          <h1>Seu catálogo, pronto para compartilhar.</h1>
          <p className="subtitle">
            Selecione os produtos e gere um PDF visual, organizado por
            departamento, seção e marca.
          </p>
        </div>
        <div className="hero-icon">
          <FileText size={38} />
        </div>
      </section>
      <section className="filters no-print">
        <label className="search-field">
          <Search size={19} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto ou marca"
          />
        </label>
        <label>
          Departamento
          <select
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setSection("");
              setBrand("");
            }}
          >
            <option value="">Todos</option>
            {departments.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Seção
          <select
            value={section}
            onChange={(e) => {
              setSection(e.target.value);
              setBrand("");
            }}
          >
            <option value="">Todas</option>
            {sections.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Marca
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">Todas</option>
            {brands.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </section>
      <div className="toolbar no-print">
        <p>
          {loading
            ? "Carregando catálogo..."
            : `${visible.length} produtos disponíveis para o PDF`}
        </p>
        <div>
          <button
            className="refresh-button"
            onClick={loadCatalog}
            disabled={loading}
          >
            <RefreshCw size={17} /> Atualizar
          </button>
          <button
            className="pdf-button"
            onClick={() => window.print()}
            disabled={loading || !visible.length}
          >
            <Download size={18} /> Gerar PDF
          </button>
        </div>
      </div>
      {error && (
        <div className="status error no-print">
          {error}
          <button onClick={loadCatalog}>Tentar novamente</button>
        </div>
      )}
      {loading && (
        <div className="status no-print">
          <LoaderCircle className="spin" size={23} /> Buscando produtos e
          imagens...
        </div>
      )}
      {!loading && !error && (
        <article className="catalog-document">
          <div className="document-heading">
            <img
              className="pdf-logo"
              src="/logo-riograndense.png"
              alt="Distribuidora Riograndense"
            />
            <div>
              <span className="print-brand">DISTRIBUIDORA RIOGRANDENSE</span>
              <h2>Catálogo de produtos</h2>
            </div>
            <span>{visible.length} produtos</span>
          </div>
          {catalog.map(({ department, sections }) => (
            <section className="department" key={department}>
              <h3>{department}</h3>
              {sections.map(({ section, brands }) => (
                <div className="section-group" key={section}>
                  <h4>{section}</h4>
                  {brands.map(({ brand, products: items }) => (
                    <div className="brand-group" key={brand}>
                      <h5>{brand}</h5>
                      <div className="product-grid">
                        {items.map((p) => (
                          <figure className="product-card" key={p.CODPROD}>
                            <div className="product-image">
                              <img
                                src={p.IMAGEM}
                                alt={p.DESCRICAO || "Produto"}
                                onError={() => invalidate(p.CODPROD)}
                              />
                            </div>
                            <figcaption>{p.DESCRICAO}</figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ))}
          {!visible.length && (
            <div className="empty">
              <ImageOff size={28} />
              Nenhum produto com imagem foi encontrado para estes filtros.
            </div>
          )}
        </article>
      )}
    </main>
  );
}
export default App;
