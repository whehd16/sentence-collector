import {
  ACTION_LOGOUT,
  ACTION_LOGIN_REQUEST,
  ACTION_LOGIN_SUCCESS,
  ACTION_LOGIN_FAILURE,
  ACTION_ADD_LANGUAGE_REQUEST,
  ACTION_ADD_LANGUAGE_SUCCESS,
  ACTION_ADD_LANGUAGE_FAILURE,
  ACTION_REMOVE_LANGUAGE_REQUEST,
  ACTION_REMOVE_LANGUAGE_SUCCESS,
  ACTION_REMOVE_LANGUAGE_FAILURE,
  ACTION_SUBMIT_SENTENCES_REQUEST,
  ACTION_SUBMIT_SENTENCES_SUCCESS,
  ACTION_SUBMIT_SENTENCES_FAILURE
} from '../actions';

export const INITIAL_STATE = {
  authed: false,
  pendingAuth: false,
  username: null,
  password: null,
  languages: [],
  pendingLanguages: false,
  sentences: [],
  pendingSentences: false,
};

function copyInto(oldObj, newObj) {
  return Object.assign({}, oldObj, newObj);
}

function mergeArray(arr1, arr2) {
  arr1 && arr1.forEach(item => (arr2.indexOf(item) === -1 && arr2.push(item)));
  return arr2;
}

export default function reducer(state = INITIAL_STATE, action) {
  switch(action.type) {
    case ACTION_LOGOUT:
    case ACTION_LOGIN_FAILURE:
      return copyInto(state, INITIAL_STATE);

    case ACTION_LOGIN_SUCCESS:
      return  copyInto(state, {
        authed: true,
        pendingAuth: false,
        username: action.username,
        password: action.password,
        languages: action.languages,
      });

    case ACTION_LOGIN_REQUEST:
      return copyInto(state, {
        authed: false,
        pendingAuth: true,
      });

    case ACTION_ADD_LANGUAGE_REQUEST:
      return copyInto(state, {
        pendingLanguages: true,
      });

    case ACTION_ADD_LANGUAGE_SUCCESS:
      return copyInto(state, {
        pendingLanguages: false,
        languages: action.languages,
      });

    case ACTION_ADD_LANGUAGE_FAILURE:
      return copyInto(state, {
        pendingLanguages: false,
      });

    case ACTION_REMOVE_LANGUAGE_REQUEST:
      return copyInto(state, {
        pendingLanguages: true,
      });

    case ACTION_REMOVE_LANGUAGE_SUCCESS:
      return copyInto(state, {
        pendingLanguages: false,
        languages: action.languages,
      });

    case ACTION_REMOVE_LANGUAGE_FAILURE:
      return copyInto(state, {
        pendingLanguages: false,
      });

    case ACTION_SUBMIT_SENTENCES_REQUEST:
      return copyInto(state, {
        pendingSentences: true,
      });

    case ACTION_SUBMIT_SENTENCES_SUCCESS:
      return copyInto(state, {
        pendingSentences: false,
        sentences: mergeArray(state.sentences, action.sentences),
      });

    case ACTION_SUBMIT_SENTENCES_FAILURE:
      return copyInto(state, {
        pendingSentences: false,
      });

    default:
      return state;
  }
}
