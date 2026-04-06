(() => {
  // Claves unicas para mantener datos mock entre pantallas.
  const STORAGE_KEYS = {
    invoices: "claims_demo_invoices_v1",
    claims: "claims_demo_claims_v1"
  };

  const INVOICE_STATUS = {
    SIN_RECLAMO: "Sin reclamo",
    EN_RECLAMO: "En reclamo",
    RECLAMO_RECHAZADO: "Reclamo rechazado",
    PENDIENTE_DEVOLUCION: "Pendiente de devolucion",
    DEVOLUCION_GESTIONADA: "Devolucion gestionada",
    PRODUCTO_DEVUELTO: "Producto devuelto"
  };

  const CATEGORY_MAP = {
    internos: {
      label: "Procesos internos (Logistica / Planificacion)",
      motives: ["Entrega tardia", "Producto incompleto"]
    },
    comercial: {
      label: "Accion comercial mal estructurada",
      motives: ["Pedido mal ingresado", "Error en precios"]
    },
    calidad: {
      label: "Producto no conforme (calidad)",
      motives: ["Producto danado", "Producto defectuoso"]
    }
  };

  const CLAIM_TIMING = [
    { value: "post_entrega", label: "Post entrega" },
    { value: "contra_entrega", label: "Contra entrega" }
  ];

  const INITIAL_INVOICES = [
    {
      id: "INV-1001",
      number: "F001-000145",
      client: "Comercial Andina S.A.",
      date: "2026-03-28",
      total: 1850.4,
      status: INVOICE_STATUS.SIN_RECLAMO,
      products: [
        { id: "P-11", name: "Leche Entera 1L", quantity: 120 },
        { id: "P-12", name: "Yogurt Natural 500g", quantity: 60 },
        { id: "P-13", name: "Queso Fresco 250g", quantity: 45 }
      ]
    },
    {
      id: "INV-1002",
      number: "F001-000146",
      client: "Distribuidora Pacifico",
      date: "2026-03-29",
      total: 2310.75,
      status: INVOICE_STATUS.SIN_RECLAMO,
      products: [
        { id: "P-21", name: "Galleta Integral 200g", quantity: 180 },
        { id: "P-22", name: "Cereal Avena 400g", quantity: 92 },
        { id: "P-23", name: "Mermelada Fresa 300g", quantity: 70 }
      ]
    },
    {
      id: "INV-1003",
      number: "F001-000147",
      client: "Mercados del Norte",
      date: "2026-03-30",
      total: 1642.2,
      status: INVOICE_STATUS.SIN_RECLAMO,
      products: [
        { id: "P-31", name: "Atun en agua 170g", quantity: 135 },
        { id: "P-32", name: "Aceite vegetal 900ml", quantity: 88 },
        { id: "P-33", name: "Arroz premium 1kg", quantity: 110 }
      ]
    }
  ];

  const safeParse = (raw, fallback) => {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  };

  const read = (key, fallback) => safeParse(localStorage.getItem(key), fallback);
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const init = () => {
    // Inicializa datos mock solo la primera vez.
    if (!localStorage.getItem(STORAGE_KEYS.invoices)) {
      write(STORAGE_KEYS.invoices, INITIAL_INVOICES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.claims)) {
      write(STORAGE_KEYS.claims, []);
    }
  };

  const deriveInvoiceStatusFromClaim = (claim) => {
    if (!claim) {
      return INVOICE_STATUS.SIN_RECLAMO;
    }

    if (claim.status === "pendiente") {
      return INVOICE_STATUS.EN_RECLAMO;
    }

    if (claim.decision?.result === "rechazado") {
      return INVOICE_STATUS.RECLAMO_RECHAZADO;
    }

    if (claim.decision?.result === "aceptado") {
      if (claim.logisticsStatus === "gestionado") {
        return INVOICE_STATUS.DEVOLUCION_GESTIONADA;
      }
      if (claim.logisticsStatus === "completado") {
        return INVOICE_STATUS.PRODUCTO_DEVUELTO;
      }
      return INVOICE_STATUS.PENDIENTE_DEVOLUCION;
    }

    return INVOICE_STATUS.EN_RECLAMO;
  };

  const getInvoices = () => {
    const invoices = read(STORAGE_KEYS.invoices, []);
    const claims = read(STORAGE_KEYS.claims, []).map(normalizeClaim);
    const claimMap = new Map(claims.map((claim) => [claim.invoiceId, claim]));

    return invoices.map((invoice) => ({
      ...invoice,
      status: deriveInvoiceStatusFromClaim(claimMap.get(invoice.id))
    }));
  };
  const saveClaims = (claims) => write(STORAGE_KEYS.claims, claims);

  const resolveWarehouseByClaim = (claim) =>
    claim?.categoryKey === "calidad" ? "Bodega de transito" : "Bodega PT";

  const normalizeClaim = (claim) => {
    const accepted = claim?.decision?.result === "aceptado";
    let logisticsStatus = claim.logisticsStatus;

    if (!accepted) {
      logisticsStatus = null;
    } else if (!logisticsStatus) {
      if (!claim.logisticsRecord) {
        logisticsStatus = "pendiente";
      } else if (claim.logisticsRecord.reception) {
        logisticsStatus = "completado";
      } else {
        logisticsStatus = "gestionado";
      }
    }

    if (logisticsStatus === "pendiente_gestion") {
      logisticsStatus = "pendiente";
    }
    if (logisticsStatus === "completado" && claim.logisticsRecord && !claim.logisticsRecord.reception) {
      // Compatibilidad con version previa: antes "completado" ocurria al gestionar.
      logisticsStatus = "gestionado";
    }

    return {
      ...claim,
      coverageMode: claim.coverageMode || "parcial",
      logisticsStatus,
      logisticsRecord: claim.logisticsRecord || null
    };
  };

  const getClaims = () => {
    const claims = read(STORAGE_KEYS.claims, []);
    const normalized = claims.map(normalizeClaim);
    if (JSON.stringify(claims) !== JSON.stringify(normalized)) {
      write(STORAGE_KEYS.claims, normalized);
    }
    return normalized;
  };

  const getInvoiceById = (invoiceId) => getInvoices().find((item) => item.id === invoiceId);
  const getClaimByInvoiceId = (invoiceId) => getClaims().find((item) => item.invoiceId === invoiceId);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(value);

  const formatDate = (dateString) =>
    new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(dateString));

  const registerClaim = (payload) => {
    const claims = getClaims();

    const existingClaimIndex = claims.findIndex((item) => item.invoiceId === payload.invoiceId);
    const now = new Date().toISOString();

    const claim = {
      invoiceId: payload.invoiceId,
      categoryKey: payload.categoryKey,
      categoryLabel: payload.categoryLabel,
      generalMotive: payload.generalMotive,
      claimTiming: payload.claimTiming,
      claimTimingLabel: payload.claimTimingLabel,
      productDetails: payload.productDetails,
      coverageMode: payload.coverageMode || "parcial",
      status: "pendiente",
      createdAt: existingClaimIndex >= 0 ? claims[existingClaimIndex].createdAt : now,
      updatedAt: now,
      decision: null,
      logisticsStatus: null,
      logisticsRecord: null
    };

    // Si ya existe reclamo para la factura, se reemplaza.
    if (existingClaimIndex >= 0) {
      claims[existingClaimIndex] = claim;
    } else {
      claims.push(claim);
    }

    saveClaims(claims);
    return claim;
  };

  const evaluateClaim = ({ invoiceId, decision, logisticType, returnSummary }) => {
    const claims = getClaims();
    const claimIndex = claims.findIndex((item) => item.invoiceId === invoiceId);
    if (claimIndex === -1) {
      return null;
    }

    const isAccepted = decision === "aceptado";
    claims[claimIndex] = {
      ...claims[claimIndex],
      status: "resuelto",
      decision: {
        result: decision,
        logisticType: logisticType || null,
        returnSummary: returnSummary || "",
        decidedAt: new Date().toISOString()
      },
      logisticsStatus: isAccepted ? "pendiente" : null,
      logisticsRecord: null,
      updatedAt: new Date().toISOString()
    };
    saveClaims(claims);

    return claims[claimIndex];
  };

  const saveLogisticsManagement = ({ invoiceId, pickupDateTime, pickedBy, transport, route }) => {
    const claims = getClaims();
    const claimIndex = claims.findIndex((item) => item.invoiceId === invoiceId);
    if (claimIndex === -1) {
      return null;
    }

    const claim = claims[claimIndex];
    if (claim?.decision?.result !== "aceptado" || claim.logisticsStatus !== "pendiente") {
      return null;
    }

    const warehouse = resolveWarehouseByClaim(claim);
    claims[claimIndex] = {
      ...claim,
      logisticsStatus: "gestionado",
      logisticsRecord: {
        logisticType: claim.decision.logisticType,
        warehouse,
        transport,
        route,
        pickupDateTime,
        pickedBy,
        managedAt: new Date().toISOString(),
        reception: null
      },
      updatedAt: new Date().toISOString()
    };
    saveClaims(claims);
    return claims[claimIndex];
  };

  const completeLogisticsReception = ({ invoiceId, receivedProductIds, partialReason }) => {
    const claims = getClaims();
    const claimIndex = claims.findIndex((item) => item.invoiceId === invoiceId);
    if (claimIndex === -1) {
      return null;
    }

    const claim = claims[claimIndex];
    if (claim?.decision?.result !== "aceptado" || claim.logisticsStatus !== "gestionado") {
      return null;
    }

    const totalProducts = claim.productDetails.length;
    const uniqueReceived = [...new Set(receivedProductIds || [])];
    if (!uniqueReceived.length) {
      return null;
    }

    const allReceived = uniqueReceived.length === totalProducts;
    if (!allReceived && !partialReason?.trim()) {
      return null;
    }

    claims[claimIndex] = {
      ...claim,
      logisticsStatus: "completado",
      logisticsRecord: {
        ...claim.logisticsRecord,
        reception: {
          receivedProductIds: uniqueReceived,
          allReceived,
          partialReason: allReceived ? "" : partialReason.trim(),
          receivedAt: new Date().toISOString()
        }
      },
      updatedAt: new Date().toISOString()
    };
    saveClaims(claims);
    return claims[claimIndex];
  };

  init();

  window.AppData = {
    CATEGORY_MAP,
    CLAIM_TIMING,
    INVOICE_STATUS,
    getInvoices,
    getClaims,
    getInvoiceById,
    getClaimByInvoiceId,
    formatCurrency,
    formatDate,
    resolveWarehouseByClaim,
    registerClaim,
    evaluateClaim,
    saveLogisticsManagement,
    completeLogisticsReception
  };
})();
