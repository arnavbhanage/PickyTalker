export function ProductPreview() {
  return (
    <section className="preview-section section-wrap" aria-labelledby="preview-title">
      <div className="preview-card">
        <div className="preview-card-top">
          <div>
            <span className="preview-label">A more personal reply</span>
            <span className="preview-subtitle">An illustrative example</span>
          </div>
          <span className="preview-window" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
        <div className="message incoming-message">
          <span className="message-label">INCOMING</span>
          <p>Are you coming tonight?</p>
        </div>
        <div className="reply-options">
          <span className="message-label">POSSIBLE REPLIES</span>
          <ol>
            <li className="reply-option reply-option-selected">
              <span className="reply-option-number">1</span>
              <span>yea ill be there in 10</span>
              <span className="reply-selected-label">Selected example</span>
            </li>
            <li className="reply-option">
              <span className="reply-option-number">2</span>
              <span>Yep, I&apos;ll be there shortly.</span>
            </li>
            <li className="reply-option">
              <span className="reply-option-number">3</span>
              <span>Yes, I will attend tonight.</span>
            </li>
          </ol>
        </div>
        <div className="preview-reasons">
          <span>Similar length</span>
          <span>Casual phrasing</span>
          <span>Light punctuation</span>
        </div>
        <p className="preview-footnote">Illustrative example only. No live recommendation.</p>
      </div>
      <div className="preview-aside">
        <span className="section-kicker">A closer look</span>
        <h2 id="preview-title">Same message. Different ways to say it.</h2>
        <p>
          PickyTalker is designed to bring forward the option that best matches
          how you naturally write, while keeping the choice yours.
        </p>
      </div>
    </section>
  );
}
