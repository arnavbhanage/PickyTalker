# Third-party components

## Chat generation and selected-reply references

`src/components/ui/lattice-loader.tsx` and its CSS module adapt the 3x3 orbit
pattern and opacity animation from [React Bits Lattice Loader](https://github.com/DavidHDev/react-bits/tree/main/src/ts-default/Micro/LatticeLoader).
Changes: waiting-only subset, scoped CSS, no timer or status marks, completely
static reduced-motion fallback. The React Bits license reproduced below applies
to Lattice Loader, Peek Rating and Code Slots.

## React Bits Peek Rating

`src/components/ui/peek-rating.tsx` and its CSS module adapt the star preview,
lift and label-tip treatment from [React Bits Peek Rating](https://reactbits.dev/micro/peek-rating)
([source](https://github.com/DavidHDev/react-bits/tree/main/src/ts-default/Micro/PeekRating)).
Changes: five usefulness levels only, existing shadcn/Lucide components,
Radix radio keyboard/focus semantics, declarative hover/focus preview, 44px tap
targets and CSS-only reduced-motion-safe lift. No pointer capture, Hugeicons,
imperative animation or new dependency. Feedback is memory-only per reply;
it is not submitted or persisted. The React Bits license below applies.

`src/components/ui/text-generate-effect.tsx` adapts the word reveal from
[Aceternity Text Generate Effect](https://ui.aceternity.com/components/text-generate-effect)
([registry source](https://ui.aceternity.com/registry/text-generate-effect.json), author Manu Arora).
Changes: CSS animation, exact whitespace preservation, bounded total reveal,
immediate full screen-reader text and static reduced-motion fallback. It is
mounted only after a complete validated backend response, not simulated streaming.

[Skiper86](https://skiper-ui.com/v1/skiper86) supplies the soft AI-gradient design
reference for the otherwise static generation status. [Skiper42](https://skiper-ui.com/v1/skiper42)
supplies the copy/check interaction reference. These are original implementations
using existing shadcn/Lucide components; no restricted Pro source was copied.

## Skiper106 composer reference

`src/components/chat/message-composer.tsx` uses the rounded input treatment of
[Skiper UI's Smooth Caret Input (Skiper106)](https://skiper-ui.com/v1/skiper106)
as a design reference. `src/components/ui/smooth-textarea.tsx` implements the
gliding caret overlay in an original multiline adaptation using a hidden DOM
mirror for real wrapping, tabs and Unicode rather than single-line canvas
measurement. Movement uses a short eased CSS transition, not DialKit or debug
controls. Native text, selection and keyboard semantics are retained. The native
caret is restored for selection, IME composition, mobile/coarse pointers, bidi
text, reduced motion and unsupported geometry; forced-colors CSS also restores
the native caret. Mirrors and listeners are cleaned up on unmount.

## Aceternity Dotted Glow Background

`src/components/ui/dotted-glow-background.tsx` adapts the canvas dot-grid and
triangular glow treatment from [Aceternity UI](https://ui.aceternity.com/components/dotted-glow-background)
([registry source](https://ui.aceternity.com/registry/dotted-glow-background.json), author Manu Arora).
Changes: a restrained light-theme subset, stable per-dot variation, static
reduced-motion rendering, tab-visibility pausing, and resize/unmount cleanup.

## React Bits Code Slots

`src/components/auth/CodeSlots.tsx` and `CodeSlots.css` are adapted from
[React Bits](https://github.com/DavidHDev/react-bits/tree/main/src/ts-default/Micro/CodeSlots).
Changes: Lucide check icon, light-theme defaults, form hidden value, full-code paste replacement, and visible focus outline.

+MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
