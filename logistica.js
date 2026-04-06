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

  const labelByLogisticType = (type) =>
    type === "contra_entrega" ? "Contra entrega" : "Post entrega";

  const getAcceptedLogisticsCases = () => {
    const invoices = window.AppData.getInvoices();
    return window.AppData.getClaims()
      .filter((claim) => claim.status === "resuelto" && claim.decision?.result === "aceptado")
      .map((claim) => {
        const invoice = invoices.find((inv) => inv.id === claim.invoiceId);
        if (!invoice) {
          return null;
        }
        return { claim, invoice };
      })
      .filter(Boolean);
  };

  const renderPendientesScreen = () => {
    const cases = getAcceptedLogisticsCases();
    const pendingCases = cases.filter(({ claim }) => claim.logisticsStatus === "pendiente");
    const managedCases = cases.filter(({ claim }) => claim.logisticsStatus === "gestionado");

    const manageTableWrap = document.getElementById("manageTableWrap");
    const manageEmpty = document.getElementById("manageEmpty");
    const manageTableBody = document.getElementById("manageTableBody");
    const managedTableWrap = document.getElementById("managedTableWrap");
    const managedEmpty = document.getElementById("managedEmpty");
    const managedTableBody = document.getElementById("managedTableBody");

    if (!pendingCases.length) {
      manageTableWrap.classList.add("hidden");
      manageEmpty.classList.remove("hidden");
    } else {
      manageTableWrap.classList.remove("hidden");
      manageEmpty.classList.add("hidden");
      manageTableBody.innerHTML = pendingCases
        .map(({ invoice, claim }) => {
          const warehouse = window.AppData.resolveWarehouseByClaim(claim);
          return `
            <tr>
              <td>${invoice.number}</td>
              <td>${invoice.client}</td>
              <td>${labelByLogisticType(claim.decision.logisticType)}</td>
              <td>${warehouse}</td>
              <td><span class="status status-pending">Pendiente de gestion</span></td>
              <td>
                <a class="btn btn-primary" href="logistica-gestion.html?invoice=${invoice.id}">
                  Gestionar retiro
                </a>
              </td>
            </tr>
          `;
        })
        .join("");
    }

    if (!managedCases.length) {
      managedTableWrap.classList.add("hidden");
      managedEmpty.classList.remove("hidden");
    } else {
      managedTableWrap.classList.remove("hidden");
      managedEmpty.classList.add("hidden");
      managedTableBody.innerHTML = managedCases
        .map(({ invoice, claim }) => {
          const record = claim.logisticsRecord || {};
          return `
            <tr>
              <td>${invoice.number}</td>
              <td>${invoice.client}</td>
              <td>${record.transport || "-"}</td>
              <td>${record.route || "-"}</td>
              <td>${record.pickupDateTime || "-"}</td>
              <td><span class="status status-claim">Gestionado</span></td>
              <td>
                <a class="btn btn-primary" href="logistica-recepcion.html?invoice=${invoice.id}">
                  Ver devolucion
                </a>
              </td>
            </tr>
          `;
        })
        .join("");
    }
  };

  const renderGestionScreen = () => {
    const logisticsMessage = document.getElementById("logisticsMessage");
    hideBanner(logisticsMessage);

    const invoiceId = getQuery("invoice");
    const invoice = window.AppData.getInvoiceById(invoiceId);
    const claim = window.AppData.getClaimByInvoiceId(invoiceId);
    if (!invoice || !claim) {
      showBanner(logisticsMessage, "error", "No se encontro el caso logistico para esta factura.");
      return;
    }

    const isValidCase =
      claim.status === "resuelto" &&
      claim.decision?.result === "aceptado" &&
      claim.logisticsStatus === "pendiente";
    if (!isValidCase) {
      showBanner(logisticsMessage, "error", "Este caso no esta pendiente de gestion.");
      return;
    }

    const logisticType = claim.decision.logisticType;
    const warehouse = window.AppData.resolveWarehouseByClaim(claim);
    const contraSection = document.getElementById("contraEntregaFields");
    const postSection = document.getElementById("postEntregaFields");
    const plannedProductsBody = document.getElementById("plannedProductsBody");
    const saveBtn = document.getElementById("saveLogisticsBtn");

    document.getElementById("invoiceContext").textContent = `${invoice.number} - ${invoice.client}`;
    document.getElementById("logisticTypeValue").textContent = labelByLogisticType(logisticType);
    document.getElementById("warehouseValue").textContent = warehouse;

    plannedProductsBody.innerHTML = claim.productDetails
      .map((item) => `
        <tr>
          <td>${item.productName}</td>
          <td>${item.quantity}</td>
          <td>${item.motive}</td>
        </tr>
      `)
      .join("");

    if (logisticType === "contra_entrega") {
      contraSection.classList.remove("hidden");
      postSection.classList.add("hidden");
    } else {
      contraSection.classList.add("hidden");
      postSection.classList.remove("hidden");
    }

    saveBtn.addEventListener("click", () => {
      hideBanner(logisticsMessage);

      const transport = document.getElementById("transportInput").value.trim();
      const route = document.getElementById("routeInput").value.trim();
      let pickupDateTime = "";
      let pickedBy = "";

      if (!transport || !route) {
        showBanner(logisticsMessage, "error", "Complete transporte y ruta.");
        return;
      }

      if (logisticType === "contra_entrega") {
        pickupDateTime = document.getElementById("contraPickupDateTime").value;
        pickedBy = document.getElementById("contraPickedBy").value.trim();
        if (!pickupDateTime || !pickedBy) {
          showBanner(logisticsMessage, "error", "Complete fecha/hora real y quien retiro.");
          return;
        }
      } else {
        pickupDateTime = document.getElementById("postPickupDateTime").value;
        pickedBy = document.getElementById("postPickedBy").value.trim();
        if (!pickupDateTime || !pickedBy) {
          showBanner(logisticsMessage, "error", "Complete fecha/hora programada y quien va a retirar.");
          return;
        }
      }

      const updated = window.AppData.saveLogisticsManagement({
        invoiceId: invoice.id,
        pickupDateTime,
        pickedBy,
        transport,
        route
      });
      if (!updated) {
        showBanner(logisticsMessage, "error", "No se pudo guardar la gestion de retiro.");
        return;
      }

      showBanner(logisticsMessage, "success", "Gestion registrada. Ahora puede entrar a Ver devolucion.");
      setTimeout(() => {
        window.location.href = "logistica-pendientes.html";
      }, 1200);
    });
  };

  const renderRecepcionScreen = () => {
    const receptionMessage = document.getElementById("receptionMessage");
    hideBanner(receptionMessage);

    const invoiceId = getQuery("invoice");
    const invoice = window.AppData.getInvoiceById(invoiceId);
    const claim = window.AppData.getClaimByInvoiceId(invoiceId);
    if (!invoice || !claim) {
      showBanner(receptionMessage, "error", "No se encontro la devolucion gestionada para esta factura.");
      return;
    }

    const isValidCase =
      claim.status === "resuelto" &&
      claim.decision?.result === "aceptado" &&
      claim.logisticsStatus === "gestionado";
    if (!isValidCase) {
      showBanner(receptionMessage, "error", "Este caso no esta pendiente de recepcion.");
      return;
    }

    const record = claim.logisticsRecord || {};
    const productsBody = document.getElementById("receptionProductsBody");
    const selectAllReceived = document.getElementById("selectAllReceived");
    const partialReasonWrap = document.getElementById("partialReasonWrap");
    const partialReason = document.getElementById("partialReason");
    const confirmReceptionBtn = document.getElementById("confirmReceptionBtn");

    document.getElementById("invoiceContext").textContent = `${invoice.number} - ${invoice.client}`;
    document.getElementById("logisticTypeValue").textContent = labelByLogisticType(record.logisticType);
    document.getElementById("warehouseValue").textContent = record.warehouse || window.AppData.resolveWarehouseByClaim(claim);
    document.getElementById("transportValue").textContent = record.transport || "-";
    document.getElementById("routeValue").textContent = record.route || "-";
    document.getElementById("dateTimeValue").textContent = record.pickupDateTime || "-";

    productsBody.innerHTML = claim.productDetails
      .map((item) => `
        <tr data-product-id="${item.productId}">
          <td><input type="checkbox" class="received-check"></td>
          <td>${item.productName}</td>
          <td>${item.quantity}</td>
          <td>${item.motive}</td>
        </tr>
      `)
      .join("");

    const syncReceptionState = () => {
      const checks = [...productsBody.querySelectorAll(".received-check")];
      const total = checks.length;
      const selected = checks.filter((input) => input.checked).length;
      selectAllReceived.checked = selected > 0 && selected === total;

      if (selected === total && total > 0) {
        partialReasonWrap.classList.add("hidden");
        confirmReceptionBtn.disabled = false;
        return;
      }

      if (selected > 0 && selected < total) {
        partialReasonWrap.classList.remove("hidden");
        confirmReceptionBtn.disabled = !partialReason.value.trim();
        return;
      }

      partialReasonWrap.classList.add("hidden");
      confirmReceptionBtn.disabled = true;
    };

    selectAllReceived.addEventListener("change", (event) => {
      const checked = event.target.checked;
      productsBody.querySelectorAll(".received-check").forEach((input) => {
        input.checked = checked;
      });
      syncReceptionState();
    });

    productsBody.addEventListener("change", (event) => {
      if (event.target.classList.contains("received-check")) {
        syncReceptionState();
      }
    });

    partialReason.addEventListener("input", syncReceptionState);

    confirmReceptionBtn.addEventListener("click", () => {
      hideBanner(receptionMessage);

      const selectedIds = [...productsBody.querySelectorAll("tr")]
        .filter((row) => row.querySelector(".received-check").checked)
        .map((row) => row.dataset.productId);
      const totalProducts = claim.productDetails.length;
      const allReceived = selectedIds.length === totalProducts;
      const reasonText = partialReason.value.trim();

      if (!selectedIds.length) {
        showBanner(receptionMessage, "error", "Marque al menos un producto recibido.");
        return;
      }
      if (!allReceived && !reasonText) {
        showBanner(receptionMessage, "error", "Ingrese motivo porque no se recibio todo.");
        return;
      }

      const updated = window.AppData.completeLogisticsReception({
        invoiceId: invoice.id,
        receivedProductIds: selectedIds,
        partialReason: reasonText
      });
      if (!updated) {
        showBanner(receptionMessage, "error", "No se pudo confirmar el retiro.");
        return;
      }

      showBanner(receptionMessage, "success", "Retiro confirmado y recepcion registrada.");
      setTimeout(() => {
        window.location.href = "logistica-pendientes.html";
      }, 1200);
    });

    syncReceptionState();
  };

  if (page === "logistica-pendientes") {
    renderPendientesScreen();
  }

  if (page === "logistica-gestion") {
    renderGestionScreen();
  }

  if (page === "logistica-recepcion") {
    renderRecepcionScreen();
  }
})();
