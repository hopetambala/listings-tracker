import '@testing-library/jest-dom'

// Stub all dl-* web components so jsdom doesn't warn about unknown elements.
// Each stub renders its children transparently so text content is queryable.
const DL_TAGS = [
  'dl-button',
  'dl-input',
  'dl-text',
  'dl-heading',
  'dl-card',
  'dl-spinner',
  'dl-dialog',
]

for (const tag of DL_TAGS) {
  if (!customElements.get(tag)) {
    customElements.define(
      tag,
      class extends HTMLElement {
        connectedCallback() {
          // expose label / placeholder attributes as accessible text
          const label = this.getAttribute('label')
          if (label && !this.querySelector('[data-label]')) {
            const span = document.createElement('span')
            span.setAttribute('data-label', '')
            span.textContent = label
            this.prepend(span)
          }
        }
      }
    )
  }
}
