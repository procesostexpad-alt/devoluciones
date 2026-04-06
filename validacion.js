(() => {
  const page = document.body.dataset.page;

  const getQuery = (key) => {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  };

  const showBanner = (element, type, message) => {
    element.className = `banner banner-${type}`;
    element.textContent = message;
    element.classList.remove("hidden");
  };

  const hideBanner = (element) => {
    element.classList.add("hidden");
    element.textContent = "";
  };

  const getPendingItems = () => {
    const invoices = window.AppData.getInvoices();
    // Muestra solo reclamos aun no evaluados.
    const pendingClaims = window.AppData.getClaims().filter((item) => item.status === "pendiente");
    return pendingClaims
      .map((claim) => {
        const invoice = invoices.find((inv) => inv.id === claim.invoiceId);
        if (!invoice) {
          return null;
        }
        return { invoice, claim };
      })
      .filter(Boolean);
  };

  const renderPendingClaimsScreen = () => {
    const pendingItems = getPendingItems();
    const tableWrap = document.getElementById("pendingTableWrap");
    const emptyState = document.getElementById("pendingEmpty");
    const tbody = document.getElementById("pendingTableBody");

    if (!pendingItems.length) {
      tableWrap.classList.add("hidden");
      emptyState.classList.remove("hidden");
      return;
    }

    tableWrap.classList.remove("hidden");
    emptyState.classList.add("hidden");
    tbody.innerHTML = pendingItems
      .map(({ invoice }) => {
        return `
          <tr>
            <td>${invoice.number}</td>
            <td>${invoice.client}</td>
            <td>${window.AppData.formatDate(invoice.date)}</td>
            <td><span class="status status-pending">Reclamo pendiente</span></td>
            <td>
              <a class="btn btn-primary" href="validacion-revision.html?invoice=${invoice.id}">
                Revisar Reclamo
              </a>
            </td>
          </tr>
        `;
      })
      .join("");
  };

  const renderClaimReviewScreen = () => {
    const reviewMessage = document.getElementById("reviewMessage");
    hideBanner(reviewMessage);

    const invoiceId = getQuery("invoice");
    const invoice = window.AppData.getInvoiceById(invoiceId);
    const claim = window.AppData.getClaimByInvoiceId(invoiceId);

    if (!invoice || !claim) {
      showBanner(reviewMessage, "error", "No se encontro un reclamo pendiente para la factura seleccionada.");
      return;
    }
    if (claim.status !== "pendiente") {
      showBanner(reviewMessage, "error", "Este reclamo ya fue revisado y no esta pendiente.");
      return;
    }

    const coverageLabel = claim.coverageMode === "total" ? "Total" : "Parcial";
    document.getElementById("invoiceContext").textContent = `${invoice.number} - ${invoice.client}`;
    document.getElementById("claimTypeValue").textContent =
      `${claim.categoryLabel} / ${claim.claimTimingLabel} / ${coverageLabel}`;
    document.getElementById("claimGeneralMotive").textContent = claim.generalMotive;

    const productsBody = document.getElementById("affectedProductsBody");
    productsBody.innerHTML = claim.productDetails
      .map((item) => {
        return `
          <tr>
            <td>${item.productName}</td>
            <td>${item.quantity}</td>
            <td>${item.motive}</td>
            <td>${item.observation || "<span class='muted'>Sin observacion</span>"}</td>
          </tr>
        `;
      })
      .join("");

    const observationList = document.getElementById("observationList");
    const observations = claim.productDetails
      .filter((item) => item.observation)
      .map((item) => `${item.productName}: ${item.observation}`);
    observationList.innerHTML = observations.length
      ? observations.map((item) => `<li>${item}</li>`).join("")
      : "<li>Sin observaciones registradas.</li>";

    const decisionInputs = document.querySelectorAll("input[name='claimDecision']");
    const acceptFields = document.getElementById("acceptFields");
    const confirmBtn = document.getElementById("confirmDecisionBtn");

    const syncAcceptFields = () => {
      const decision = document.querySelector("input[name='claimDecision']:checked")?.value;
      if (decision === "aceptar") {
        acceptFields.classList.remove("hidden");
      } else {
        acceptFields.classList.add("hidden");
      }
    };
    decisionInputs.forEach((input) => input.addEventListener("change", syncAcceptFields));

    confirmBtn.addEventListener("click", () => {
      hideBanner(reviewMessage);
      const decision = document.querySelector("input[name='claimDecision']:checked")?.value;
      if (!decision) {
        showBanner(reviewMessage, "error", "Seleccione si el reclamo se acepta o se rechaza.");
        return;
      }

      let logisticType = "";
      let returnSummary = "";
      if (decision === "aceptar") {
        // La aceptacion exige definir gestion logistica y resumen final.
        logisticType = document.querySelector("input[name='logisticType']:checked")?.value || "";
        returnSummary = document.getElementById("returnSummary").value.trim();
        if (!logisticType) {
          showBanner(reviewMessage, "error", "Seleccione el tipo de gestion logistica.");
          return;
        }
        if (!returnSummary) {
          showBanner(reviewMessage, "error", "Ingrese el motivo de devolucion (resumen final).");
          return;
        }
      }

      const updated = window.AppData.evaluateClaim({
        invoiceId: invoice.id,
        decision: decision === "aceptar" ? "aceptado" : "rechazado",
        logisticType,
        returnSummary
      });

      if (!updated) {
        showBanner(reviewMessage, "error", "No se pudo actualizar la decision del reclamo.");
        return;
      }

      if (decision === "aceptar") {
        const logisticText = logisticType === "contra_entrega"
          ? "Contra entrega: logistica debe registrar retiro real."
          : "Post entrega: logistica debe programar retiro.";
        showBanner(reviewMessage, "success", `Decision confirmada. Se genero orden de devolucion. ${logisticText}`);
      } else {
        showBanner(reviewMessage, "success", "Decision confirmada. El reclamo fue cerrado sin devolucion.");
      }

      setTimeout(() => {
        window.location.href = decision === "aceptar"
          ? "logistica-pendientes.html"
          : "validacion-facturas.html";
      }, 1400);
    });
  };

  if (page === "validacion-facturas") {
    renderPendingClaimsScreen();
  }

  if (page === "validacion-revision") {
    renderClaimReviewScreen();
  }
})();
