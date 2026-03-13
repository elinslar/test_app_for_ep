"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { OrderedRef } from "@/lib/orderedRefs";
import type { Template } from "@/lib/templates/types";

type SelectedProduct =
  | { kind: "upload"; id: string; file: File; previewUrl: string }
  | { kind: "productId"; id: string; productId: string; name?: string; bestHref?: string | null };

type GenerateResponse = {
  resultDataUrls?: string[];
  error?: string;
};

type ProductLookupResponse = {
  found?: boolean;
  product?: { productId: string; name: string; categoryName?: string };
  bestHref?: string | null;
  error?: string;
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();

  if (!text) {
    return `HTTP ${response.status}`;
  }

  try {
    const json = JSON.parse(text) as { error?: string };
    return json.error ?? text;
  } catch {
    return text;
  }
}

function createUploadProduct(file: File): SelectedProduct {
  return {
    kind: "upload",
    id: uuid(),
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

export default function Page() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");

  const [sceneBlob, setSceneBlob] = useState<Blob | null>(null);
  const [sceneUrl, setSceneUrl] = useState("");

  const [busyScene, setBusyScene] = useState(false);
  const [busyGen, setBusyGen] = useState(false);
  const [err, setErr] = useState("");

  const [sceneFixPrompt, setSceneFixPrompt] = useState("");
  const [productIdInput, setProductIdInput] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [placementPrompt, setPlacementPrompt] = useState("");
  const [variants, setVariants] = useState(4);
  const [resultDataUrls, setResultDataUrls] = useState<string[]>([]);
  const [selectedVariant, setSelectedVariant] = useState(0);

  const sceneUrlRef = useRef("");
  const uploadPreviewUrlsRef = useRef<Set<string>>(new Set());

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templates, templateId]
  );

  const maxProductsReached = selectedProducts.length >= 4;

  const setSceneFromBlob = useCallback((blob: Blob) => {
    const nextUrl = URL.createObjectURL(blob);

    setSceneBlob(blob);
    setSceneUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      return nextUrl;
    });

    sceneUrlRef.current = nextUrl;
  }, []);

  const clearScene = useCallback(() => {
    setSceneBlob(null);
    setSceneUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return "";
    });
    sceneUrlRef.current = "";
  }, []);

  const clearResults = useCallback(() => {
    setResultDataUrls([]);
    setSelectedVariant(0);
  }, []);

  useEffect(() => {
    return () => {
      if (sceneUrlRef.current) {
        URL.revokeObjectURL(sceneUrlRef.current);
      }

      for (const previewUrl of uploadPreviewUrlsRef.current) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    async function loadInitialTemplates() {
      try {
        const response = await fetch("/api/templates");
        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        const data = (await response.json()) as Template[];
        setTemplates(data);

        if (data.length > 0) {
          setTemplateId(data[0].id);
        }
      } catch (error) {
        setErr(toErrorMessage(error));
      }
    }

    void loadInitialTemplates();
  }, []);

  const loadSceneForTemplate = useCallback(
    async (nextTemplateId: string) => {
      const template = templates.find((item) => item.id === nextTemplateId);
      if (!template) return;

      setErr("");
      clearResults();
      clearScene();

      setBusyScene(true);
      try {
        if (template.type === "hard") {
          const response = await fetch(
            `/api/template-image?templateId=${encodeURIComponent(nextTemplateId)}`,
            { cache: "no-store" }
          );

          if (!response.ok) {
            throw new Error(await readErrorMessage(response));
          }

          setSceneFromBlob(await response.blob());
          return;
        }

        const response = await fetch("/api/scene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: nextTemplateId }),
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        setSceneFromBlob(await response.blob());
      } finally {
        setBusyScene(false);
      }
    },
    [clearResults, clearScene, setSceneFromBlob, templates]
  );

  useEffect(() => {
    if (!templateId || templates.length === 0) {
      return;
    }

    loadSceneForTemplate(templateId).catch((error) => setErr(toErrorMessage(error)));
  }, [loadSceneForTemplate, templateId, templates.length]);

  function removeProduct(id: string) {
    setSelectedProducts((previous) => {
      const product = previous.find((item) => item.id === id);

      if (product?.kind === "upload") {
        URL.revokeObjectURL(product.previewUrl);
        uploadPreviewUrlsRef.current.delete(product.previewUrl);
      }

      return previous.filter((item) => item.id !== id);
    });
  }

  function moveProduct(id: string, direction: -1 | 1) {
    setSelectedProducts((previous) => {
      const index = previous.findIndex((product) => product.id === id);
      if (index < 0) return previous;

      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= previous.length) return previous;

      const copy = [...previous];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  }

  function setMain(id: string) {
    setSelectedProducts((previous) => {
      const index = previous.findIndex((product) => product.id === id);
      if (index <= 0) return previous;

      const copy = [...previous];
      const [item] = copy.splice(index, 1);
      copy.unshift(item);
      return copy;
    });
  }

  async function addProductId() {
    try {
      setErr("");

      const productId = productIdInput.trim();

      if (!productId) {
        throw new Error("Skriv productId");
      }

      if (maxProductsReached) {
        throw new Error("Maks 4 produkter");
      }

      const response = await fetch(
        `/api/products/by-id?productId=${encodeURIComponent(productId)}`
      );
      const data = (await response.json()) as ProductLookupResponse;

      if (!response.ok) {
        throw new Error(data.error || "Product lookup feilet");
      }

      if (!data.found) {
        throw new Error("Fant ikke produkt");
      }

      setSelectedProducts((previous) => [
        ...previous,
        {
          kind: "productId",
          id: uuid(),
          productId,
          name: data.product?.name,
          bestHref: data.bestHref ?? null,
        },
      ]);

      setProductIdInput("");
    } catch (error) {
      setErr(toErrorMessage(error));
    }
  }

  function addUploads(files: FileList | null) {
    if (!files) return;

    setErr("");

    setSelectedProducts((previous) => {
      const room = 4 - previous.length;
      if (room <= 0) return previous;

      const nextProducts = Array.from(files)
        .slice(0, room)
        .map(createUploadProduct);

      nextProducts.forEach((product) => {
        if (product.kind === "upload") {
          uploadPreviewUrlsRef.current.add(product.previewUrl);
        }
      });

      return [...previous, ...nextProducts];
    });
  }

  async function regenerateScene() {
    try {
      if (!selectedTemplate) {
        throw new Error("Ingen template valgt");
      }

      if (selectedTemplate.type !== "soft") {
        throw new Error("Regenerering gjelder kun soft templates");
      }

      await loadSceneForTemplate(templateId);
    } catch (error) {
      setErr(toErrorMessage(error));
    }
  }

  async function refineScene() {
    try {
      setErr("");

      if (!sceneBlob) {
        throw new Error("Ingen scene å endre");
      }

      if (!sceneFixPrompt.trim()) {
        throw new Error("Skriv hva du vil endre");
      }

      setBusyScene(true);

      const formData = new FormData();
      formData.append("instruction", sceneFixPrompt.trim());
      formData.append(
        "scene",
        new File([sceneBlob], "scene.png", { type: sceneBlob.type || "image/png" })
      );

      const response = await fetch("/api/scene-refine", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      setSceneFromBlob(await response.blob());
    } catch (error) {
      setErr(toErrorMessage(error));
    } finally {
      setBusyScene(false);
    }
  }

  async function generate() {
    try {
      setErr("");
      clearResults();

      if (!sceneBlob) {
        throw new Error("Miljøbilde er ikke klart ennå");
      }

      if (selectedProducts.length < 1 || selectedProducts.length > 4) {
        throw new Error("Velg 1–4 produkter");
      }

      if (!placementPrompt.trim()) {
        throw new Error("Skriv en placement prompt");
      }

      setBusyGen(true);

      const orderedRefs: OrderedRef[] = selectedProducts.map((product) =>
        product.kind === "productId"
          ? { kind: "productId", value: product.productId }
          : { kind: "upload", value: product.file.name }
      );

      const uploads = selectedProducts.filter(
        (product): product is Extract<SelectedProduct, { kind: "upload" }> =>
          product.kind === "upload"
      );

      const formData = new FormData();
      formData.append("placementPrompt", placementPrompt.trim());
      formData.append("variants", String(variants));
      formData.append("orderedRefs", JSON.stringify(orderedRefs));
      formData.append(
        "scene",
        new File([sceneBlob], "scene.png", { type: sceneBlob.type || "image/png" })
      );

      for (const upload of uploads) {
        formData.append("products", upload.file);
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as GenerateResponse;

      if (!response.ok) {
        throw new Error(data.error || "Generate feilet");
      }

      setResultDataUrls(data.resultDataUrls ?? []);
      setSelectedVariant(0);
    } catch (error) {
      setErr(toErrorMessage(error));
    } finally {
      setBusyGen(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 1250,
        margin: "24px auto",
        padding: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>Miljøbilde + produktplassering (uten mask/inpainting)</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "460px 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <h2 style={{ marginTop: 0 }}>1) Velg miljø</h2>

          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            style={{ width: "100%" }}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.type})
              </option>
            ))}
          </select>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Miljøbilde</div>

            {busyScene ? (
              <div
                style={{
                  padding: 12,
                  border: "1px dashed #aaa",
                  borderRadius: 8,
                }}
              >
                Laster/genererer...
              </div>
            ) : sceneUrl ? (
              <>
                <img
                  src={sceneUrl}
                  alt="scene"
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                  }}
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
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        Hva vil du endre i scenen?
                      </div>
                      <input
                        value={sceneFixPrompt}
                        onChange={(event) => setSceneFixPrompt(event.target.value)}
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
              <div
                style={{
                  padding: 12,
                  border: "1px dashed #aaa",
                  borderRadius: 8,
                }}
              >
                Ingen scene
              </div>
            )}
          </div>

          <h2 style={{ marginTop: 18 }}>2) Velg 1–4 produkter</h2>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={productIdInput}
              onChange={(event) => setProductIdInput(event.target.value)}
              placeholder="productId (Databricks)"
              style={{ flex: 1 }}
            />
            <button onClick={addProductId} disabled={maxProductsReached}>
              Legg til
            </button>
          </div>

          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => addUploads(event.target.files)}
            disabled={maxProductsReached}
          />

          {selectedProducts.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 8,
                marginTop: 10,
              }}
            >
              {selectedProducts.map((product, index) => (
                <div
                  key={product.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    padding: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.85,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {index === 0 ? "Main: " : ""}
                      {product.kind === "upload"
                        ? product.file.name
                        : `${product.productId}${product.name ? ` – ${product.name}` : ""}`}
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => moveProduct(product.id, -1)}
                        disabled={index === 0}
                        title="Flytt opp"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveProduct(product.id, 1)}
                        disabled={index === selectedProducts.length - 1}
                        title="Flytt ned"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => setMain(product.id)}
                        disabled={index === 0}
                        title="Sett som main"
                      >
                        ⭐
                      </button>
                      <button onClick={() => removeProduct(product.id)} title="Fjern">
                        X
                      </button>
                    </div>
                  </div>

                  {product.kind === "upload" ? (
                    <img
                      src={product.previewUrl}
                      alt="upload"
                      style={{ width: "100%", borderRadius: 8, marginTop: 6 }}
                    />
                  ) : product.bestHref ? (
                    <img
                      src={product.bestHref}
                      alt="dbx"
                      style={{ width: "100%", borderRadius: 8, marginTop: 6 }}
                    />
                  ) : (
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                      Ingen bestHref
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <h2 style={{ marginTop: 18 }}>3) Prompt for plassering</h2>

          <textarea
            value={placementPrompt}
            onChange={(event) => setPlacementPrompt(event.target.value)}
            rows={6}
            style={{ width: "100%" }}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <label style={{ flex: 1 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Varianter</div>
              <select
                value={variants}
                onChange={(event) => setVariants(Number(event.target.value))}
                style={{ width: "100%" }}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </label>

            <button
              onClick={generate}
              disabled={busyGen || busyScene}
              style={{ flex: 1, padding: 10, alignSelf: "end" }}
            >
              {busyGen ? "Genererer..." : "Generer"}
            </button>
          </div>

          {err && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                border: "1px solid #f3b",
                background: "#ffeaf2",
              }}
            >
              {err}
            </div>
          )}
        </section>

        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Resultat</h2>

          {resultDataUrls.length === 0 ? (
            <div
              style={{
                padding: 16,
                border: "1px dashed #aaa",
                borderRadius: 8,
              }}
            >
              Ingen resultat ennå
            </div>
          ) : (
            <>
              <img
                src={resultDataUrls[selectedVariant]}
                alt="selected-result"
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: "1px solid #ddd",
                }}
              />

              <h3>Velg beste variant</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 8,
                }}
              >
                {resultDataUrls.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedVariant(index)}
                    style={{
                      border:
                        index === selectedVariant
                          ? "2px solid #000"
                          : "1px solid #ddd",
                      borderRadius: 8,
                      padding: 0,
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <img
                      src={url}
                      alt={`variant-${index}`}
                      style={{
                        width: "100%",
                        borderRadius: 8,
                        display: "block",
                      }}
                    />
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