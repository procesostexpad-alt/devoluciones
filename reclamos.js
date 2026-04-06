(() => {
  const page = document.body.dataset.page;

  const showBanner = (element, type, message) => {
    element.className = `banner banner-${type}`;
    element.textContent = message;
    element.classList.remove("hidden");
  };

  const hideBanner = (element) => {
    element.classList.add("hidden");
    element.textContent = "";
  };

  const getQuery = (key) => {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  };

  const renderInvoicesScreen = () => {
    const tbody = document.getElementById("invoicesTableBody");
    const invoices = window.AppData.getInvoices();
    const statusClassByInvoice = (status) => {
      const map = window.AppData.INVOICE_STATUS;
      if (status === map.EN_RECLAMO) {
        return "status-claim";
      }
      if (status === map.RECLAMO_RECHAZADO) {
        return "status-rejected";
      }
      if (status === map.PENDIENTE_DEVOLUCION) {
        return "status-pending";
      }
      if (status === map.DEVOLUCION_GESTIONADA) {
        return "status-managed";
      }
      if (status === map.PRODUCTO_DEVUELTO) {
        return "status-accepted";
      }
      return "status-normal";
    };

    tbody.innerHTML = invoices
      .map((invoice) => {
        return `
          <tr>
            <td>${invoice.number}</td>
            <td>${invoice.client}</td>
            <td>${window.AppData.formatDate(invoice.date)}</td>
            <td>${window.AppData.formatCurrency(invoice.total)}</td>
            <td>
              <span class="status ${statusClassByInvoice(invoice.status)}">
                ${invoice.status}
              </span>
            </td>
            <td>
              <a class="btn btn-primary" href="reclamos-formulario.html?invoice=${invoice.id}">
                Registrar Reclamo
              </a>
            </td>
          </tr>
        `;
      })
      .join("");
  };

  const buildMotiveOptions = (categoryKey) => {
    const category = window.AppData.CATEGORY_MAP[categoryKey];
    if (!category) {
      return `<option value="">Seleccione una opcion</option>`;
    }

    return [
      `<option value="">Seleccione una opcion</option>`,
      ...category.motives.map((motive) => `<option value="${motive}">${motive}</option>`)
    ].join("");
  };

  const buildMultiMotiveOptions = (categoryKey) => {
    const category = window.AppData.CATEGORY_MAP[categoryKey];
    if (!category) {
      return "";
    }
    return category.motives.map((motive) => `<option value="${motive}">${motive}</option>`).join("");
  };

  const renderClaimFormScreen = () => {
    const formMessage = document.getElementById("formMessage");
    hideBanner(formMessage);

    const invoiceId = getQuery("invoice");
    const invoice = window.AppData.getInvoiceById(invoiceId);
    if (!invoice) {
      showBanner(formMessage, "error", "No se encontro la factura seleccionada.");
      return;
    }

    const existingClaim = window.AppData.getClaimByInvoiceId(invoice.id);
    document.getElementById("invoiceContext").textContent = `${invoice.number} - ${invoice.client}`;
    document.getElementById("invoiceMeta").textContent =
      `Fecha: ${window.AppData.formatDate(invoice.date)} | Total: ${window.AppData.formatCurrency(invoice.total)}`;

    const categoryRadios = document.getElementById("categoryRadios");
    const generalMotiveSelect = document.getElementById("generalMotiveSelect");
    const timingRadios = document.getElementById("timingRadios");
    const coverageInputs = document.querySelectorAll("input[name='claimCoverage']");
    const productsBody = document.getElementById("productTableBody");
    const selectAllProducts = document.getElementById("selectAllProducts");
    const bulkModeSelect = document.getElementById("bulkModeSelect");
    const bulkSameWrap = document.getElementById("bulkSameWrap");
    const bulkMixedWrap = document.getElementById("bulkMixedWrap");
    const bulkSingleMotive = document.getElementById("bulkSingleMotive");
    const bulkMultiMotive = document.getElementById("bulkMultiMotive");
    const applyBulkBtn = document.getElementById("applyBulkBtn");

    categoryRadios.innerHTML = Object.entries(window.AppData.CATEGORY_MAP)
      .map(([key, value]) => {
        const checked = existingClaim?.categoryKey === key ? "checked" : "";
        return `
          <label class="radio-item">
            <input type="radio" name="claimCategory" value="${key}" ${checked}>
            <span>${value.label}</span>
          </label>
        `;
      })
      .join("");

    timingRadios.innerHTML = window.AppData.CLAIM_TIMING
      .map((item) => {
        const checked = existingClaim?.claimTiming === item.value ? "checked" : "";
        return `
          <label class="radio-item">
            <input type="radio" name="claimTiming" value="${item.value}" ${checked}>
            <span>${item.label}</span>
          </label>
        `;
      })
      .join("");

    const getCurrentCategory = () =>
      document.querySelector("input[name='claimCategory']:checked")?.value || "";

    const getCoverageMode = () =>
      document.querySelector("input[name='claimCoverage']:checked")?.value || "parcial";

    const updateBulkModeVisibility = () => {
      if (bulkModeSelect.value === "same") {
        bulkSameWrap.classList.remove("hidden");
        bulkMixedWrap.classList.add("hidden");
      } else {
        bulkSameWrap.classList.add("hidden");
        bulkMixedWrap.classList.remove("hidden");
      }
    };

    const syncCoverageBehavior = () => {
      const mode = getCoverageMode();
      const checks = productsBody.querySelectorAll(".product-check");
      const shouldDisableChecks = mode === "total";
      checks.forEach((input) => {
        if (shouldDisableChecks) {
          input.checked = true;
        }
        input.disabled = shouldDisableChecks;
      });
      selectAllProducts.checked = shouldDisableChecks ||
        productsBody.querySelectorAll(".product-check:checked").length === invoice.products.length;
      selectAllProducts.disabled = shouldDisableChecks;
      applyBulkBtn.disabled = mode !== "total";
      bulkModeSelect.disabled = mode !== "total";
      bulkSingleMotive.disabled = mode !== "total";
      bulkMultiMotive.disabled = mode !== "total";
    };

    const renderProductsTable = (categoryKey) => {
      // El motivo por producto se adapta al tipo de reclamo elegido.
      const options = buildMotiveOptions(categoryKey);
      productsBody.innerHTML = invoice.products
        .map((product) => {
          const detail = existingClaim?.productDetails?.find((item) => item.productId === product.id);
          const checked = detail ? "checked" : "";
          return `
            <tr data-product-id="${product.id}">
              <td><input type="checkbox" class="product-check" ${checked}></td>
              <td>${product.name}</td>
              <td>${product.quantity}</td>
              <td>
                <input type="text" class="product-observation" placeholder="Detalle del reclamo" value="${detail?.observation || ""}">
              </td>
              <td>
                <select class="product-motive">
                  ${options}
                </select>
              </td>
            </tr>
          `;
        })
        .join("");

      if (existingClaim?.productDetails?.length) {
        const rows = productsBody.querySelectorAll("tr");
        rows.forEach((row) => {
          const productId = row.dataset.productId;
          const detail = existingClaim.productDetails.find((item) => item.productId === productId);
          if (detail) {
            row.querySelector(".product-motive").value = detail.motive;
          }
        });
      }
      syncCoverageBehavior();
    };

    const applyBulkMotives = () => {
      const categoryKey = getCurrentCategory();
      if (!categoryKey) {
        showBanner(formMessage, "error", "Seleccione primero el tipo de reclamo.");
        return false;
      }
      if (getCoverageMode() !== "total") {
        showBanner(formMessage, "error", "La aplicacion masiva funciona cuando el alcance es total.");
        return false;
      }

      const rows = [...productsBody.querySelectorAll("tr")];
      if (bulkModeSelect.value === "same") {
        const motive = bulkSingleMotive.value;
        if (!motive) {
          showBanner(formMessage, "error", "Seleccione el motivo unico para aplicar a todos.");
          return false;
        }
        rows.forEach((row) => {
          row.querySelector(".product-check").checked = true;
          row.querySelector(".product-motive").value = motive;
        });
      } else {
        const selectedMotives = [...bulkMultiMotive.selectedOptions].map((option) => option.value);
        if (!selectedMotives.length) {
          showBanner(formMessage, "error", "Seleccione uno o varios motivos en modo varios.");
          return false;
        }
        rows.forEach((row, index) => {
          row.querySelector(".product-check").checked = true;
          row.querySelector(".product-motive").value = selectedMotives[index % selectedMotives.length];
        });
      }
      hideBanner(formMessage);
      return true;
    };

    const selectedCategory = existingClaim?.categoryKey || "";
    generalMotiveSelect.innerHTML = buildMotiveOptions(selectedCategory);
    bulkSingleMotive.innerHTML = buildMotiveOptions(selectedCategory);
    bulkMultiMotive.innerHTML = buildMultiMotiveOptions(selectedCategory);
    if (existingClaim?.generalMotive) {
      generalMotiveSelect.value = existingClaim.generalMotive;
    }

    const initialCoverage = existingClaim?.coverageMode || "parcial";
    const coverageInput = document.querySelector(`input[name='claimCoverage'][value='${initialCoverage}']`);
    if (coverageInput) {
      coverageInput.checked = true;
    }

    renderProductsTable(selectedCategory);
    updateBulkModeVisibility();
    syncCoverageBehavior();

    categoryRadios.addEventListener("change", () => {
      const categoryKey = getCurrentCategory();
      generalMotiveSelect.innerHTML = buildMotiveOptions(categoryKey);
      bulkSingleMotive.innerHTML = buildMotiveOptions(categoryKey);
      bulkMultiMotive.innerHTML = buildMultiMotiveOptions(categoryKey);
      renderProductsTable(categoryKey);
    });

    coverageInputs.forEach((input) =>
      input.addEventListener("change", () => {
        syncCoverageBehavior();
      })
    );

    bulkModeSelect.addEventListener("change", updateBulkModeVisibility);
    applyBulkBtn.addEventListener("click", applyBulkMotives);

    selectAllProducts.addEventListener("change", (event) => {
      const checked = event.target.checked;
      productsBody.querySelectorAll(".product-check").forEach((input) => {
        input.checked = checked;
      });
    });

    productsBody.addEventListener("change", (event) => {
      if (!event.target.classList.contains("product-check")) {
        return;
      }
      const allChecked = productsBody.querySelectorAll(".product-check:checked").length === invoice.products.length;
      selectAllProducts.checked = allChecked;
    });

    const saveBtn = document.getElementById("saveClaimBtn");
    saveBtn.addEventListener("click", () => {
      hideBanner(formMessage);

      const categoryKey = getCurrentCategory();
      const timingValue = document.querySelector("input[name='claimTiming']:checked")?.value || "";
      const generalMotive = generalMotiveSelect.value;
      const coverageMode = getCoverageMode();
      const timingObj = window.AppData.CLAIM_TIMING.find((item) => item.value === timingValue);
      const categoryObj = window.AppData.CATEGORY_MAP[categoryKey];

      if (!categoryObj) {
        showBanner(formMessage, "error", "Seleccione el tipo de reclamo.");
        return;
      }
      if (!generalMotive) {
        showBanner(formMessage, "error", "Seleccione el motivo especifico.");
        return;
      }
      if (!timingObj) {
        showBanner(formMessage, "error", "Seleccione si el reclamo es post entrega o contra entrega.");
        return;
      }

      if (coverageMode === "total") {
        const bulkApplied = applyBulkMotives();
        if (!bulkApplied) {
          return;
        }
      }

      // Se construye el detalle solo con productos seleccionados.
      const selectedProducts = [];
      const rows = productsBody.querySelectorAll("tr");
      rows.forEach((row) => {
        const checked = row.querySelector(".product-check").checked;
        if (!checked) {
          return;
        }
        const productId = row.dataset.productId;
        const product = invoice.products.find((item) => item.id === productId);
        const motive = row.querySelector(".product-motive").value;
        const observation = row.querySelector(".product-observation").value.trim();

        if (!motive) {
          selectedProducts.push({ invalid: true });
          return;
        }

        selectedProducts.push({
          productId: product.id,
          productName: product.name,
          quantity: product.quantity,
          motive,
          observation
        });
      });

      if (!selectedProducts.length) {
        showBanner(formMessage, "error", "Seleccione al menos un producto en el detalle.");
        return;
      }
      if (coverageMode === "total" && selectedProducts.length !== invoice.products.length) {
        showBanner(formMessage, "error", "En modo total deben quedar todos los productos seleccionados.");
        return;
      }
      if (selectedProducts.some((item) => item.invalid)) {
        showBanner(formMessage, "error", "Cada producto seleccionado debe tener un motivo especifico.");
        return;
      }

      window.AppData.registerClaim({
        invoiceId: invoice.id,
        categoryKey,
        categoryLabel: categoryObj.label,
        generalMotive,
        claimTiming: timingObj.value,
        claimTimingLabel: timingObj.label,
        coverageMode,
        productDetails: selectedProducts
      });

      showBanner(formMessage, "success", "Reclamo guardado. La factura quedo con estado: En reclamo.");
      setTimeout(() => {
        window.location.href = "reclamos-facturas.html";
      }, 900);
    });
  };

  if (page === "reclamos-facturas") {
    renderInvoicesScreen();
  }

  if (page === "reclamos-formulario") {
    renderClaimFormScreen();
  }
})();
