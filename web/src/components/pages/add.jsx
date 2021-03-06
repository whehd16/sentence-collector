import React from 'react';
import tokenizeSentences from 'talisman/tokenizers/sentences';
import tokenizeWords from 'talisman/tokenizers/words';
import {
  PunktTrainer,
  PunktSentenceTokenizer
} from 'talisman/tokenizers/sentences/punkt';

import WebDB from '../../web-db';
import { arrayCompare } from '../../../../shared/util';
import LanguageSelector from '../language-selector';
import ReviewForm from '../review-form';
import '../../../css/add.css';

const MAX_WORDS = 14;

const SENTENCE_STATE_SUBMITTED = 'submitted';
const SENTENCE_STATE_UNREVIEWED = 'unreviewed';
const SENTENCE_STATE_REVIEWING = 'reviewing';
const SENTENCE_STATE_VALIDATED = 'validated';
const SENTENCE_STATE_INVALIDATED = 'invalidated';
const SENTENCE_STATE_FILTERED = 'filtered';

const REGEX_BOUNDARY_PIPE = /([.?!])\s*[\n\|]/g;
const REGEX_ALL_PIPE = /[\n\|]/g;

// Use a collection of English text from common voice to train punkt.
import TRAINING_TEXT from '../../../all_en.txt';

const DEFAULT_STATE = {
  message: '',
  error: '',
  submitted: [],
  unreviewed: [],
  reviewing: [],
  validated: [],
  invalidated: [],
  filtered: [],
  existing: [],
};

function merge(arr1, arr2) {
  return arr1.reduce((accum, cur) => {
    return accum.indexOf(cur) === -1 ? accum.concat([cur]) : accum;
  }, arr2);
}

export default class Add extends React.Component {
  constructor(props) {
    super(props);
    this.state = DEFAULT_STATE;
    this.trainer = new PunktTrainer();
    this.trainer.INCLUDE_ALL_COLLOCS = true;

    this.trainer.train(TRAINING_TEXT);
    this.tokenizer = new PunktSentenceTokenizer(this.trainer.getParams());

    this.onSubmit = this.onSubmit.bind(this);
    this.onConfirm = this.onConfirm.bind(this);
    this.onCancel = this.onCancel.bind(this);
    this.onReview = this.onReview.bind(this);
    this.onReviewed = this.onReviewed.bind(this);
  }

  async filterSentences(language, sentences) {
    let filtered = [];

    // Remove sentences that are more than MAX_WORDS.
    let valid = sentences.filter(sen => {
      const words = tokenizeWords(sen);
      if (words.length > MAX_WORDS) {
        filtered.push(sen);
        return false;
      }

      return true;
    });

    // Remove sentences that are already defined.
    const db = new WebDB(this.props.username, this.props.password);
    const existing = await db.validateSentences(language, sentences);
    const existingSentences = existing.map(s => s.sentence);

    valid = valid.filter(s => existingSentences.indexOf(s) === -1);

    return {
      existing: existingSentences,
      valid,
      filtered,
    };
  }

  resetState() {
    this.setState(DEFAULT_STATE);
  }

  getLanguageInput() {
    const i = document.querySelector('#add-form select');
    return i && i.value;
  }

  getSentencesInput() {
    const i = document.querySelector('#sentences-input');
    return i && i.value;
  }

  getReadySentences() {
    return [...this.state.unreviewed, ...this.state.validated];
  }

  validateForm() {
    let lang = this.getLanguageInput();
    if (!lang) {
      this.resetState();
      this.setState({
        message: 'Please select a langauge.',
      });
      return false;
    }


    let rawInput = this.getSentencesInput();
    if (!rawInput) {
      this.setState({
        message: 'Please add sentences.',
      });
      return false;
    }

    return true;
  }

  async parseSentences(language, text) {
    // This next section is for dealing with the | (pipe) character from:
    // https://docs.google.com/spreadsheets/d/15HK8boTLejnOK5UuOkNQ3OLphEL8H4rOy_QtOBQbcks/
    //
    // First replace the pipe on sentences that have ending punctuation already.
    let updatedText = text.replace(REGEX_BOUNDARY_PIPE, '$1 ');
    // Then add a period to any sentences that don't have ending punctuation.
    updatedText = updatedText.replace(REGEX_ALL_PIPE, '. ');
    const submitted = tokenizeSentences(updatedText);
    const punktSentences = this.tokenizer.tokenize(updatedText);

    if (!arrayCompare(punktSentences, submitted)) {
      console.warn('talisman and punkt did not agree', punktSentences, submitted);
    }

    // Always trim, and for now we use punkt.
    const trimmed = punktSentences.map(s => s.trim());
    const { valid, filtered, existing } = await this.filterSentences(language, trimmed);

    this.setState({
      language,
      existing,
      submitted: trimmed,
      unreviewed: valid,
      filtered,
    });
  }

  onSubmit(evt) {
    evt.preventDefault();

    if (!this.validateForm()) {
      return false;
    }

    this.resetState();
    this.parseSentences(this.getLanguageInput(), this.getSentencesInput());
  }

  async onConfirm(evt) {
    try {
      evt.preventDefault();
      const readySentences = this.getReadySentences();
      const language = this.state.language;
      const { sentences, errors } =
        await this.props.submitSentences(language, readySentences);

      let message = sentences.length > 0 ?
          `Submited ${sentences.length} sentences.` : ''
      let error = errors.length > 0 ?
          `${errors.length} sentences failed` : '';

      this.resetState();
      this.setState({
        message,
        error,
      });
    } catch (err) {
      this.resetState();
      this.setState({
        message: 'Submission error: ' + err,
      });
    }
  }

  onCancel(evt) {
    evt.preventDefault();
    this.resetState();
  }

  onReview(type) {
    const sentences = type === SENTENCE_STATE_SUBMITTED ?
                      this.state.unreviewed : this.state.filtered;
    this.setState({
      reviewing: sentences,
    });
  }

  onReviewed(reviewedState) {
    this.setState({
      reviewing: [],
      unreviewed: reviewedState.unreviewed,
      validated: merge(this.state.validated, reviewedState.validated),
      invalidated: merge(this.state.invalidated, reviewedState.invalidated),
    });
  }

  render() {
    if (this.state.reviewing.length > 0) {
      // The review form allows us to examine, and validate sentences.
      return <ReviewForm onReviewed={this.onReviewed}
                         sentences={this.state.reviewing} />;

    } else if (this.state.unreviewed.length > 0 ||
               this.state.validated.length > 0 ||
               this.state.invalidated.length > 0 ||
               this.state.filtered.length > 0) {

      // The confirm form is a stats page where sentence submission happens.
      return <ConfirmForm onSubmit={this.onConfirm}
                          onReview={this.onReview}
                          onCancel={this.onCancel}
                          submitted={this.state.submitted}
                          unreviewed={this.state.unreviewed}
                          validated={this.state.validated}
                          invalidated={this.state.invalidated}
                          filtered={this.state.filtered}
                          existing={this.state.existing}
                          ready={this.getReadySentences()} />;

    } else {
      // The plain submission form allows copy & pasting
      return <SubmitForm onSubmit={this.onSubmit}
                         message={this.state.message}
                         error={this.state.error}
                         languages={this.props.languages} />;
    }
  }
}

const ReviewLink = (props) => {
  return props.sentences.length > 0 && (
    <a onClick={evt => {
      evt.preventDefault();
      props.onReview && props.onReview(props.type);
    }}>{ props.type === SENTENCE_STATE_SUBMITTED ? 'review' : 'fix'}</a>
  );
};

const ConfirmForm = (props) => (
  <form onSubmit={props.onSubmit}>
    <h2>Confirm New Sentences</h2>
    <p>
      {`${props.submitted.length} sentences found.`}
    </p>
    {(props.existing && props.existing.length > 0) && (
      <p>
        {`${props.existing.length} sentences were previously submitted.`}
      </p>
    )}
    {props.invalidated.length + props.filtered.length > 0 && (
      <p style={{color: 'red'}}>
        {
          `${props.filtered.length} sentences were too long.` +
          (props.invalidated.length > 0 ?
            ` (${props.invalidated.length} more rejected by you) ` : '')
        }
        <ReviewLink onReview={props.onReview}
                    sentences={props.filtered}
                    type={SENTENCE_STATE_FILTERED} />
      </p>
    )}
    {props.unreviewed.length > 0 && (
      <p>
        {`-- ${props.unreviewed.length} of these sentences are unreviewed.`}
        <ReviewLink onReview={props.onReview}
                    sentences={props.unreviewed}
                    type={SENTENCE_STATE_SUBMITTED} />
      </p>
    )}
    {props.validated.length + props.invalidated.length > 0 && (
      <p>
        {`-- ${props.validated.length + props.invalidated.length}`}&nbsp;
        sentences are already reviewed. Great job!
      </p>
    )}
    <p><b>{`${props.ready.length} sentences ready for submission!`}</b></p>
    <section id="confirm-buttons">
      <button type="submit">Confirm</button>
      <button onClick={props.onCancel}>Cancel</button>
    </section>
  </form>
);


const SubmitForm = (props) => (
  <form id="add-form" onSubmit={props.onSubmit}>
    <h2>Add Sentences</h2>
    <p>Please add your sentences by typing or copy & pasting them below.</p>
    <section id="form-message">
      {props.message}
    </section>
    <section id="form-error">
      {props.error}
    </section>
    <section>
      <label className="language-selector-label" htmlFor="language-selector">
        Select Language
      </label>
      <LanguageSelector name="language-selector" only={props.languages}/>
    </section>
    <section>
      <label htmlFor="sentences-input">Enter sentences</label>
      <textarea id="sentences-input" />
    </section>
    <section>
      <button>Submit</button>
    </section>
  </form>
);
