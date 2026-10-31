import { element, request, sourceLink } from "./shared.js";

const sourceCategories = {
  general_contractor_project_update: "Project updates",
  owner_project_progress_page: "Project updates",
  owner_annual_report: "Project updates",
  special_inspection_provider_case_study: "Technical reports",
  product_manufacturer_case_study: "Technical reports",
  structural_engineer_project_page: "Technical reports",
  public_design_review_minutes: "Design review records",
};

function showSelection() {
  const status = document.querySelector("#selection-status");
  const records = document.querySelector("#source-records");
  status.hidden = true;
  document.querySelectorAll(".highlighted-passage").forEach(node => {
    node.classList.remove("highlighted-passage");
    node.removeAttribute("aria-current");
  });
  let target = null;
  let linked = false;
  if (location.hash) {
    try {
      const match = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (!match || !records.contains(match)) throw new Error();
      target = match;
      linked = true;
    } catch {
      status.hidden = false;
      status.textContent = "This link is not in the supplied corpus. Choose a category above.";
    }
  }
  const selectedGroup = target?.closest(".source-group");
  document.querySelector("#source-overview").hidden = Boolean(selectedGroup);
  records.querySelectorAll(".source-group").forEach(group => {
    group.hidden = group !== selectedGroup;
  });
  document.querySelectorAll(".source-category-link").forEach(link => {
    if (link.hash.slice(1) === selectedGroup?.id) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
  if (target?.classList.contains("corpus-passage")) {
    target.classList.add("highlighted-passage");
    target.setAttribute("aria-current", "true");
    status.hidden = false;
    status.textContent = `Highlighted: ${target.id}`;
  }
  if (!linked) return;
  requestAnimationFrame(() => {
    if (target === selectedGroup) {
      document.querySelector(".corpus-navigation").scrollIntoView({ block: "start", behavior: "instant" });
    } else {
      target.scrollIntoView({ block: "center", behavior: "instant" });
      target.focus({ preventScroll: true });
    }
  });
}

async function load() {
  try {
    const data = await request("/api/documents");
    document.querySelector("#corpus-count").textContent = `${data.sourceCount} sources · ${data.documents.length} passages · v${data.version}`;
    const sources = new Map();
    for (const passage of data.documents) {
      if (!sources.has(passage.sourceId)) sources.set(passage.sourceId, []);
      sources.get(passage.sourceId).push(passage);
    }
    const navigation = document.querySelector("#source-navigation");
    const records = document.querySelector("#source-records");
    const previews = document.querySelector("#source-previews");
    const groups = new Map();
    for (const passages of sources.values()) {
      const source = passages[0];
      const category = sourceCategories[source.sourceType] || "Other sources";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(passages);
      const preview = element("a", "source-preview-card panel");
      preview.href = `#${encodeURIComponent(source.sourceId)}`;
      preview.append(element("p", "source-publisher", source.publisher), element("h3", "", source.title));
      previews.append(preview);
    }
    for (const [category, groupedSources] of groups) {
      const categoryId = `category-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const categoryLink = element("a", "source-category-link");
      categoryLink.href = `#${categoryId}`;
      categoryLink.append(element("span", "", category), element("span", "source-category-count", `${groupedSources.length} sources`));
      categoryLink.addEventListener("click", () => {
        if (location.hash === categoryLink.hash) showSelection();
      });
      navigation.append(categoryLink);
      const recordGroup = element("section", "source-group");
      recordGroup.id = categoryId;
      recordGroup.tabIndex = -1;
      recordGroup.hidden = true;
      recordGroup.append(element("h2", "source-group-title", category));
      records.append(recordGroup);
      for (const passages of groupedSources) {
        const source = passages[0];
        const article = element("article", "source-record panel");
        article.id = source.sourceId;
        article.tabIndex = -1;
        article.append(element("p", "source-publisher", source.publisher), element("h3", "", source.title), element("p", "source-meta", source.sourceId));
        article.append(element("p", "source-meta", `${source.evidenceClass} · ${source.publishedOn || "Date not listed"}`), element("p", "source-meta", source.location));
        for (const passage of passages) {
          const section = element("section", "corpus-passage");
          section.id = passage.id;
          section.tabIndex = -1;
          section.append(element("h4", "", passage.topic), element("p", "passage-id", passage.id), element("p", "passage-text", passage.text));
          article.append(section);
        }
        article.append(element("p", "source-limits", source.limits), sourceLink(source));
        recordGroup.append(article);
      }
    }
    showSelection();
    window.addEventListener("hashchange", showSelection);
  } catch {
    const error = document.querySelector("#corpus-error");
    error.hidden = false;
    error.textContent = "The source corpus could not be loaded. Reload the page to try again.";
    document.querySelector("#corpus-count").textContent = "Corpus unavailable";
  }
}

load();
