// Public identity for the independent hosted service. Local packages keep their
// existing identity and storage; no credentials or account data belong here.
export const hostedBrand = Object.freeze({
  name: 'Conclave', publisher: 'Didactech Industries', email: 'contact@didactechindustries.com',
  tagline: 'Continue across AI apps', color: '#2357C6',
  description: 'Save your goal, decisions, constraints, and next steps from one AI conversation, then resume the work in another. Browse saved handoffs, inspect earlier versions, and see what changed.',
  prompts: Object.freeze([
    'Save a handoff so I can continue this work in another AI app.',
    'Find my handoffs for this project and help me resume.',
    'Show what changed since the previous handoff.',
  ]),
});
export const hostedIconPath = '/assets/conclave-icon.png';
export function hostedUiHtml(html) {
  // Self-contained help: no external requests, account data, or host navigation.
  return html.replace('<div id="view">', `<header class="row"><strong>Conclave</strong><span class="muted">${hostedBrand.tagline}</span></header><div id="view">`)
    .replace('</main>', `<details><summary>How Conclave works</summary><p>Ask your connected chat to save a handoff, keep the returned reference, then retrieve it in another app using the same Conclave account. This library is read-only; browsing does not save changes.</p><p>Only explicitly saved context carries over. Review saved constraints before continuing.</p><p>${hostedBrand.publisher} · ${hostedBrand.email}</p></details></main>`);
}
export function hostedServerInfo(origin) {
  return { title: hostedBrand.name, websiteUrl: `${origin}/get-started`,
    icons: [{ src: `${origin}${hostedIconPath}`, mimeType: 'image/png', sizes: ['1254x1254'] }] };
}

export function hostedDashboardHtml(html) {
  return html.replace('<!-- hosted-head -->', `<link rel="icon" type="image/png" href="${hostedIconPath}"><link rel="stylesheet" href="/assets/hosted.css">`)
    .replace('<span class="mark" aria-hidden="true">C</span>', `<img class="brand-icon" src="${hostedIconPath}" width="32" height="32" alt="">`)
    .replace('<!-- hosted-help -->', '<a href="/support">Help</a>')
    .replace('<!-- hosted-onboarding -->', `<details id="first-handoff" class="notice" hidden><summary>Save your first handoff</summary><p>In a connected AI app, copy this prompt. Saving happens only when the chat calls Conclave successfully.</p><textarea readonly rows="3" aria-label="First handoff prompt">${hostedBrand.prompts[0]}</textarea><p>Keep the returned reference, then ask another connected app to retrieve it using the same Conclave account.</p><a href="/get-started">Read the full guide</a></details>`);
}
