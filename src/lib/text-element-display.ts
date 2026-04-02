/**
 * Plain rich text (sanitized HTML), Markdown, and code highlighting for board text elements.
 * Browser-only APIs (DOMPurify, highlight.js) are guarded for SSR.
 */
import type { BoardElement, TextContentMode } from './board-types';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

marked.setOptions({ gfm: true, breaks: true });

const escapeHtml = (s: string): string =>
	s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

/** Sanitize contenteditable HTML: bold, italic, line breaks, inline font-size on spans. */
export const sanitizePlainRichHtml = (html: string): string => {
	if (typeof window === 'undefined') return escapeHtml(html);
	return DOMPurify.sanitize(html, {
		ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'br', 'span', 'div', 'p'],
		ALLOWED_ATTR: ['style', 'class']
	});
};

export const markdownToSafeHtml = (src: string): string => {
	if (typeof window === 'undefined') {
		return `<div class="text-md-fallback">${escapeHtml(src)}</div>`;
	}
	const raw = marked.parse(src || '', { async: false }) as string;
	return DOMPurify.sanitize(raw);
};

export const highlightCodeToHtml = (code: string, lang?: string): string => {
	if (typeof window === 'undefined') return escapeHtml(code);
	const l = (lang?.trim() || 'javascript').toLowerCase();
	try {
		if (hljs.getLanguage(l)) {
			return hljs.highlight(code, { language: l }).value;
		}
	} catch {
		/* try auto */
	}
	try {
		return hljs.highlightAuto(code).value;
	} catch {
		return escapeHtml(code);
	}
};

/** Plain text for canvas export / thumbnail (no rich layout on canvas). */
export const getCanvasPlainText = (element: BoardElement): string => {
	const mode: TextContentMode = element.textMode ?? 'plain';
	if (mode === 'plain') {
		return element.text ?? '';
	}
	if (mode === 'markdown') {
		return element.text ?? '';
	}
	return element.text ?? '';
};
