import { cleanup } from "@testing-library/react"
import { JSDOM } from "jsdom"

export function setupTestDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  })

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Event: dom.window.Event,
    EventTarget: dom.window.EventTarget,
    FocusEvent: dom.window.FocusEvent,
    HTMLElement: dom.window.HTMLElement,
    KeyboardEvent: dom.window.KeyboardEvent,
    MouseEvent: dom.window.MouseEvent,
    MutationObserver: dom.window.MutationObserver,
    Node: dom.window.Node,
    SVGElement: dom.window.SVGElement,
    getComputedStyle: dom.window.getComputedStyle,
  })

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  })

  if (!("PointerEvent" in globalThis)) {
    Object.assign(globalThis, {
      PointerEvent: dom.window.MouseEvent,
    })
  }

  if (!globalThis.HTMLElement.prototype.scrollIntoView) {
    globalThis.HTMLElement.prototype.scrollIntoView = () => {}
  }

  const htmlElementPrototype = globalThis.HTMLElement.prototype as
    HTMLElement & {
      attachEvent?: () => void
      detachEvent?: () => void
    }

  if (!htmlElementPrototype.attachEvent) {
    htmlElementPrototype.attachEvent = () => {}
  }

  if (!htmlElementPrototype.detachEvent) {
    htmlElementPrototype.detachEvent = () => {}
  }

  return () => {
    cleanup()
    dom.window.close()
  }
}
