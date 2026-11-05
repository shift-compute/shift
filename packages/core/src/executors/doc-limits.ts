/** Characters sent to the model. Longer documents are cut and flagged, never silently. Kept apart from doc-text so planning code does not load the PDF parser. */
export const MAX_DOC_CHARS = 24_000;
