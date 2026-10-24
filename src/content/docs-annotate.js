// Runs in the page's own JS world at document_start on Google Docs. Docs only
// renders its accessible SVG text layer ("annotated canvas") when an extension
// asks for it through this global; Socrates reads text positions from that
// layer. Leaves any value another extension already set untouched.
window._docs_annotate_canvas_by_ext ??= "socrates-reasoning-companion";
