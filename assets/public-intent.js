(function () {
  "use strict";

  const { db, sdk } = window.vocabFirebase;

  const els = {
    toggleBtns: Array.from(document.querySelectorAll(".public-intent-toggle-btn")),
    purchasePanel: document.getElementById("public-purchase-panel"),
    classPanel: document.getElementById("public-class-panel"),

    leadForm: document.getElementById("public-lead-form"),
    leadPhone: document.getElementById("public-lead-phone"),
    leadWechat: document.getElementById("public-lead-wechat"),
    leadName: document.getElementById("public-lead-name"),
    leadEmail: document.getElementById("public-lead-email"),
    leadSubmitBtn: document.getElementById("public-lead-submit-btn"),
    leadMsg: document.getElementById("public-lead-msg"),

    classForm: document.getElementById("public-class-form"),
    className: document.getElementById("public-class-name"),
    classPhone: document.getElementById("public-class-phone"),
    classWechat: document.getElementById("public-class-wechat"),
    classEmail: document.getElementById("public-class-email"),
    classGrade: document.getElementById("public-class-grade"),
    classSubmitBtn: document.getElementById("public-class-submit-btn"),
    classMsg: document.getElementById("public-class-msg"),
  };

  const panels = {
    "public-purchase-panel": els.purchasePanel,
    "public-class-panel": els.classPanel,
  };

  function openPanel(id) {
    Object.keys(panels).forEach((key) => {
      panels[key].hidden = key !== id;
    });
  }

  function closeAll() {
    Object.keys(panels).forEach((key) => {
      panels[key].hidden = true;
    });
  }

  els.toggleBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const target = btn.dataset.target;
      const panel = panels[target];
      const alreadyOpen = !panel.hidden;
      closeAll();
      if (!alreadyOpen) {
        panel.hidden = false;
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  function openFromHash() {
    const hash = window.location.hash.replace("#", "");
    if (hash === "purchase-intent") {
      openPanel("public-purchase-panel");
      els.purchasePanel.scrollIntoView({ block: "start" });
    } else if (hash === "class-interest") {
      openPanel("public-class-panel");
      els.classPanel.scrollIntoView({ block: "start" });
    }
  }
  openFromHash();
  window.addEventListener("hashchange", openFromHash);

  els.leadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const phone = els.leadPhone.value.trim();
    const wechat = els.leadWechat.value.trim();
    if (!phone && !wechat) {
      els.leadMsg.textContent = "请至少填写电话或微信号其中一项。· Please fill in phone or WeChat.";
      els.leadMsg.className = "paywall-lead-msg error";
      els.leadMsg.hidden = false;
      return;
    }
    els.leadSubmitBtn.disabled = true;
    els.leadMsg.hidden = true;
    try {
      await sdk.addDoc(sdk.collection(db, "leads"), {
        uid: null,
        source: "public_page",
        name: els.leadName.value.trim(),
        phone,
        wechat,
        contactEmail: els.leadEmail.value.trim(),
        createdAt: sdk.serverTimestamp(),
      });
      els.leadMsg.textContent = "已收到，我们会尽快与您联系。· Received — we'll be in touch soon.";
      els.leadMsg.className = "paywall-lead-msg success";
      els.leadMsg.hidden = false;
      els.leadForm.reset();
    } catch (err) {
      els.leadMsg.textContent = "提交失败，请稍后重试。· Submission failed, please try again.";
      els.leadMsg.className = "paywall-lead-msg error";
      els.leadMsg.hidden = false;
    } finally {
      els.leadSubmitBtn.disabled = false;
    }
  });

  els.classForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.classSubmitBtn.disabled = true;
    els.classMsg.hidden = true;
    try {
      await sdk.addDoc(sdk.collection(db, "classInterest"), {
        uid: null,
        source: "public_page",
        name: els.className.value.trim(),
        phone: els.classPhone.value.trim(),
        wechat: els.classWechat.value.trim(),
        contactEmail: els.classEmail.value.trim(),
        grade: els.classGrade.value,
        gradeLabel: els.classGrade.options[els.classGrade.selectedIndex].textContent,
        createdAt: sdk.serverTimestamp(),
      });
      els.classMsg.textContent = "已收到，我们会尽快与您联系。· Received — we'll be in touch soon.";
      els.classMsg.className = "paywall-lead-msg success";
      els.classMsg.hidden = false;
      els.classForm.reset();
    } catch (err) {
      els.classMsg.textContent = "提交失败，请稍后重试。· Submission failed, please try again.";
      els.classMsg.className = "paywall-lead-msg error";
      els.classMsg.hidden = false;
    } finally {
      els.classSubmitBtn.disabled = false;
    }
  });
})();
