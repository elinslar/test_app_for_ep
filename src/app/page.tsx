"use client";

import React, { useEffect, useMemo, useState } from "react";

type Template =
  | { id: string; name: string; type: "hard"; baseScene: { assetPath: string } }
  | { id: string; name: string; type: "soft"; scenePrompt: string; size?: string; quality?: string };

type SelectedProduct =
  | { kind: "upload"; id: string; file: File; previewUrl: string }
  | { kind: "productId"; id: string; productId: string; name?: string; bestHref?: string };

type GenerateResponse = { resultDataUrls?: string[]; error?: string };

type ProductLookupResponse = {
  found?: boolean;
  product?: { productId: string; name: string; categoryName?: string };
  bestHref?: string | null;
  error?: string;
};

function toErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `HTTP ${res.status}`;
  try {
    const j = JSON.parse(text) as { error?: string };
    return j.error ?? text;
  } catch {
    return text;
  }
}

export default function Page() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");

  const [sceneUrl, setSceneUrl] = useState<string>("");
  const [sceneBlob, setSceneBlob] = useState<Blob | null>(null);

  const [busyScene, setBusyScene] = useState(false);
  const [busyGen, setBusyGen] = useState(false);
  const [err, setErr] = useState<string>("");

  const [sceneFixPrompt, setSceneFixPrompt] = useState("");

  const [productIdInput, setProductIdInput] = useState("167651");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);

  const [placementPrompt, setPlacementPrompt] = useState<string>(
    ""
  );

  const [variants, setVariants] = useState<number>(4);
  const [resultDataUrls, setResultDataUrls] = useState<string[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<number>(0);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId]
  );

  function setSceneFromBlob(blob: Blob) {
    setSceneBlob(blob);
    setSceneUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  }

  useEffect(() => {
    return () => {
      if (sceneUrl) URL.revokeObjectURL(sceneUrl);
      selectedProducts.forEach((p) => {
        if (p.kind === "upload") URL.revokeObjectURL(p.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/templates");
      const json = (await res.json()) as Template[];
      setTemplates(json);
      if (json.length) setTemplateId(json[0].id);
    })();
  }, []);

  async function loadSceneForTemplate(tid: string) {
    const t = templates.find((x) => x.id === tid);
    if (!t) return;

    setErr("");
    setResultDataUrls([]);
    setSelectedVariant(0);
    setSceneBlob(null);
    setSceneUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });

    setBusyScene(true);
    try {
      if (t.type === "hard") {
        const res = await fetch(`/api/template-image?templateId=${encodeURIComponent(tid)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        const blob = await res.blob();
        setSceneFromBlob(blob);
      } else {
        const res = await fetch("/api/scene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: tid }),
        });
        if (!res.ok) throw new Error(await readErrorMessage(res));
        const blob = await res.blob();
        setSceneFromBlob(blob);
      }
    } finally {
      setBusyScene(false);
    }
  }

  
  // når template endres
  useEffect(() => {
    if (!templateId) return;
    loadSceneForTemplate(templateId).catch((e) => setErr(toErrorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, templates]);

  function removeProduct(id: string) {
    setSelectedProducts((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p?.kind === "upload") URL.revokeObjectURL(p.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }

  function moveProduct(id: string, dir: -1 | 1) {
    setSelectedProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  }

  function setMain(id: string) {
    setSelectedProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx <= 0) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.unshift(item);
      return copy;
    });
  }

  async function addProductId() {
    try {
      setErr("");
      const pid = productIdInput.trim();
      if (!pid) throw new Error("Skriv productId");
      if (selectedProducts.length >= 4) throw new Error("Maks 4 produkter");

      const res = await fetch(`/api/products/by-id?productId=${encodeURIComponent(pid)}`);
      const json = (await res.json()) as ProductLookupResponse;
      if (!res.ok) throw new Error(json.error || "product lookup feilet");
      if (!json.found) throw new Error("Fant ikke produkt");

      setSelectedProducts((prev) => [
        ...prev,
        { kind: "productId", id: uuid(), productId: pid, name: json.product?.name, bestHref: json.bestHref ?? undefined },
      ]);
    } catch (e) {
      setErr(toErrorMessage(e));
    }
  }

  function addUploads(files: FileList | null) {
    if (!files) return;
    setErr("");
    const incoming = Array.from(files);

    setSelectedProducts((prev) => {
      const room = 4 - prev.length;
      const take = incoming.slice(0, room);
      const mapped: SelectedProduct[] = take.map((f) => ({
        kind: "upload",
        id: uuid(),
        file: f,
        previewUrl: URL.createObjectURL(f),
      }));
      return [...prev, ...mapped];
    });
  }

  async function regenerateScene() {
    try {
      if (!selectedTemplate) throw new Error("Ingen template valgt");
      if (selectedTemplate.type !== "soft") throw new Error("Regenerering gjelder kun soft templates");
      await loadSceneForTemplate(templateId);
    } catch (e) {
      setErr(toErrorMessage(e));
    }
  }

  async function refineScene() {
  try {
    setErr("");
    if (!sceneBlob) throw new Error("Ingen scene å endre");
    if (!sceneFixPrompt.trim()) throw new Error("Skriv hva du vil endre");

    setBusyScene(true);

    const fd = new FormData();
    fd.append("instruction", sceneFixPrompt.trim());
    fd.append("scene", new File([sceneBlob], "scene.png", { type: sceneBlob.type || "image/png" }));

    const res = await fetch("/api/scene-refine", { method: "POST", body: fd });
    if (!res.ok) throw new Error(await readErrorMessage(res));

    const blob = await res.blob();
    setSceneFromBlob(blob); // eksisterende helper
  } catch (e) {
    setErr(toErrorMessage(e));
  } finally {
    setBusyScene(false);
  }
  }

  async function generate() {
    try {
      setErr("");
      setResultDataUrls([]);
      setSelectedVariant(0);

      if (!sceneBlob) throw new Error("Miljøbilde er ikke klart ennå");
      if (selectedProducts.length < 1 || selectedProducts.length > 4) throw new Error("Velg 1–4 produkter");
      if (!placementPrompt.trim()) throw new Error("Skriv en placement prompt");

      setBusyGen(true);

      const orderedRefs = selectedProducts.map((p) =>
        p.kind === "productId" ? ({ kind: "productId", value: p.productId } as const) : ({ kind: "upload", value: p.file.name } as const)
      );

      const uploads = selectedProducts.filter(
        (p): p is Extract<SelectedProduct, { kind: "upload" }> => p.kind === "upload"
      );

      const fd = new FormData();
      fd.append("placementPrompt", placementPrompt);
      fd.append("variants", String(variants));
      fd.append("orderedRefs", JSON.stringify(orderedRefs));

      // legg ved scene som fil
      fd.append("scene", new File([sceneBlob], "scene.png", { type: sceneBlob.type || "image/png" }));

      uploads.forEach((u) => fd.append("products", u.file));

      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const json = (await res.json()) as GenerateResponse;
      if (!res.ok) throw new Error(json.error || "generate feilet");

      setResultDataUrls(json.resultDataUrls ?? []);
      setSelectedVariant(0);
    } catch (e) {
      setErr(toErrorMessage(e));
    } finally {
      setBusyGen(false);
    }
  }

  return (
    <main style={{ maxWidth: 1250, margin: "24px auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>Miljøbilde + produktplassering (uten mask/inpainting)</h1>

      <div style={{ display: "grid", gridTemplateColumns: "460px 1fr", gap: 16, alignItems: "start" }}>
        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>1) Velg miljø</h2>

          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ width: "100%" }}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.type})
              </option>
            ))}
          </select>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Miljøbilde</div>
            {busyScene ? (
              <div style={{ padding: 12, border: "1px dashed #aaa", borderRadius: 8 }}>Laster/genererer...</div>
            ) : sceneUrl ? (
  <>
                <img
                  src={sceneUrl}
                  alt="scene"
                  style={{ width: "100%", borderRadius: 8, border: "1px solid #ddd" }}
                />

                {selectedTemplate?.type === "soft" && (
                  <>
                    <button
                      onClick={regenerateScene}
                      disabled={busyScene || busyGen}
                      style={{ width: "100%", padding: 10, marginTop: 8 }}
                    >
                      Regenerer scene
                    </button>

                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>Hva vil du endre i scenen?</div>
                      <input
                        value={sceneFixPrompt}
                        onChange={(e) => setSceneFixPrompt(e.target.value)}
                        placeholder='F.eks: "Ta bort dusjen. Behold alt annet uendret."'
                        style={{ width: "100%", marginTop: 6 }}
                      />
                      <button
                        onClick={refineScene}
                        disabled={busyScene || busyGen || !sceneFixPrompt.trim()}
                        style={{ width: "100%", padding: 10, marginTop: 8 }}
                      >
                        Fiks scene
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{ padding: 12, border: "1px dashed #aaa", borderRadius: 8 }}>Ingen scene</div>
            )}
          </div>

          <h2 style={{ marginTop: 18 }}>2) Velg 1–4 produkter</h2>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={productIdInput}
              onChange={(e) => setProductIdInput(e.target.value)}
              placeholder="productId (Databricks)"
              style={{ flex: 1 }}
            />
            <button onClick={addProductId} disabled={selectedProducts.length >= 4}>
              Legg til
            </button>
          </div>

          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => addUploads(e.target.files)}
            disabled={selectedProducts.length >= 4}
          />

          {selectedProducts.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 10 }}>
              {selectedProducts.map((p, idx) => (
                <div key={p.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <div style={{ fontSize: 12, opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {idx === 0 ? "Main: " : ""}
                      {p.kind === "upload" ? p.file.name : `${p.productId}${p.name ? ` – ${p.name}` : ""}`}
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => moveProduct(p.id, -1)} disabled={idx === 0} title="Flytt opp">↑</button>
                      <button onClick={() => moveProduct(p.id, 1)} disabled={idx === selectedProducts.length - 1} title="Flytt ned">↓</button>
                      <button onClick={() => setMain(p.id)} disabled={idx === 0} title="Sett som main">⭐</button>
                      <button onClick={() => removeProduct(p.id)} title="Fjern">X</button>
                    </div>
                  </div>

                  {p.kind === "upload" ? (
                    <img src={p.previewUrl} alt="upload" style={{ width: "100%", borderRadius: 8, marginTop: 6 }} />
                  ) : p.bestHref ? (
                    <img src={p.bestHref} alt="dbx" style={{ width: "100%", borderRadius: 8, marginTop: 6 }} />
                  ) : (
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>Ingen bestHref</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <h2 style={{ marginTop: 18 }}>3) Prompt for plassering</h2>
          <textarea value={placementPrompt} onChange={(e) => setPlacementPrompt(e.target.value)} rows={6} style={{ width: "100%" }} />

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Varianter</div>
              <select value={variants} onChange={(e) => setVariants(Number(e.target.value))} style={{ width: "100%" }}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={6}>6</option>
                <option value={8}>8</option>
              </select>
            </label>

            <button onClick={generate} disabled={busyGen || busyScene} style={{ flex: 1, padding: 10, alignSelf: "end" }}>
              {busyGen ? "Genererer..." : "Generer"}
            </button>
          </div>

          {err && <div style={{ marginTop: 10, padding: 10, border: "1px solid #f3b", background: "#ffeaf2" }}>{err}</div>}
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <h2 style={{ marginTop: 0 }}>Resultat</h2>

          {resultDataUrls.length === 0 ? (
            <div style={{ padding: 16, border: "1px dashed #aaa", borderRadius: 8 }}>Ingen resultat ennå</div>
          ) : (
            <>
              <img src={resultDataUrls[selectedVariant]} alt="selected-result" style={{ width: "100%", borderRadius: 8, border: "1px solid #ddd" }} />

              <h3>Velg beste variant</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {resultDataUrls.map((u, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedVariant(i)}
                    style={{ border: i === selectedVariant ? "2px solid #000" : "1px solid #ddd", borderRadius: 8, padding: 0, background: "transparent", cursor: "pointer" }}
                  >
                    <img src={u} alt={`variant-${i}`} style={{ width: "100%", borderRadius: 8, display: "block" }} />
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}