'use strict'

import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Modal, ListGroupItem, ListGroup } from 'react-bootstrap'
import {
  selectGistTag,
  selectGist,
  fetchSingleGist,
  updateSearchWindowStatus} from '../../actions/index'
import { bindActionCreators } from 'redux'
import { descriptionParser, addLangPrefix as Prefixed } from '../../utilities/parser'

import './index.scss'

import { remote, ipcRenderer } from 'electron'
const logger = remote.getGlobal('logger')

class SearchPage extends Component {

  constructor (props) {
    super(props)
    this.state = {
      inputValue: '',
      selectedIndex: 0,
      searchResults: []
    }
  }

  componentWillMount () {
    const { updateSearchWindowStatus, searchIndex } = this.props
    ipcRenderer.on('key-up', this.selectPreGist.bind(this))
    ipcRenderer.on('key-down', this.selectNextGist.bind(this))
    ipcRenderer.on('key-enter', this.selectCurrentGist.bind(this))
    ipcRenderer.on('exit-search', () => {
      updateSearchWindowStatus('OFF')
    })
    searchIndex.initFuseSearch()
  }

  componentWillUnmount () {
    ipcRenderer.removeAllListeners('key-up')
    ipcRenderer.removeAllListeners('key-down')
    ipcRenderer.removeAllListeners('key-enter')
  }

  selectPreGist () {
    const { selectedIndex, searchResults } = this.state
    let newSelectedIndex = selectedIndex - 1
    if (!searchResults || newSelectedIndex < 0) {
      newSelectedIndex = searchResults.length - 1
    }
    this.setState({
      selectedIndex: newSelectedIndex,
    })
  }

  selectNextGist () {
    const { selectedIndex, searchResults } = this.state
    let newSelectedIndex = selectedIndex + 1
    if (!searchResults || newSelectedIndex >= searchResults.length) {
      newSelectedIndex = 0
    }
    this.setState({
      selectedIndex: newSelectedIndex,
    })
  }

  selectCurrentGist () {
    const { selectedIndex, searchResults } = this.state
    if (searchResults && searchResults.length > 0) {
      this.handleSnippetClicked(searchResults[selectedIndex].id)
    }
  }

  handleSnippetClicked (gistId) {
    const { gists, selectGistTag, selectGist, updateSearchWindowStatus, fetchSingleGist } = this.props

    if (!gists[gistId].details) {
      logger.info('[Dispatch] fetchSingleGist ' + gistId)
      fetchSingleGist(gists[gistId], gistId)
    }
    logger.info('[Dispatch] selectGist ' + gistId)
    selectGist(gistId)

    selectGistTag(Prefixed('All'))
    updateSearchWindowStatus('OFF')
  }

  updateInputValue (evt) {
    this.setState({
      selectedIndex: 0,
      inputValue: evt.target.value
    })
  }

  queryInputValue (evt) {
    const inputValue = evt.target.value

    const searchIndex = this.props.searchIndex
    const results = searchIndex.fuseSearch(inputValue)
    this.setState({
      searchResults: results
    })
  }

  renderSnippetDescription (rawDescription) {
    const { title, description } = descriptionParser(rawDescription)

    const htmlForDescriptionSection = []
    if (title.length > 0) {
      htmlForDescriptionSection.push(<div className='title-section' key='title'>{ title }</div>)
    }
    htmlForDescriptionSection.push(<div className='description-section' key='description'>{ description }</div>)

    return (
      <div>
        { htmlForDescriptionSection }
      </div>
    )
  }

  renderSearchResults () {
    const { searchResults, selectedIndex, inputValue } = this.state

    // In some unknown circumstance, searchResults is undefined. So we put a
    // guard here. We should remove it once we better understand the mechanism
    // behind it.
    if (!inputValue || !searchResults) return null

    if (inputValue.length > 0 && searchResults.length === 0) {
      return (
        <div className='not-found-msg'>
          No result found...
        </div>
      )
    }

    const resultsJSXGroup = []
    searchResults.forEach((gist, index) => {
      let gistDescription = gist.description
      // let highlightedDescription = gistDescription.replace(inputValue, '**' + inputValue + '**')
      let highlightedDescription = gistDescription
      let langs = gist.language.split(',').filter(lang => lang.trim()).map(lang => {
        return (
          <div className='gist-tag' key={ lang.trim() }>{ '#' + lang }</div>
        )
      })
      resultsJSXGroup.push(
        <ListGroupItem
          className={ index === selectedIndex
              ? 'search-result-item-selected' : 'search-result-item' }
          key={ gist.id }
          onClick={ this.handleSnippetClicked.bind(this, gist.id) }>
          <div className='snippet-description'>{ this.renderSnippetDescription(highlightedDescription) }</div>
          <div className='gist-tag-group'>{ langs }</div>
        </ListGroupItem>
      )
    })
    return resultsJSXGroup
  }

  renderSearchModalBody () {
    return (
      <div>
        <input
          type="text"
          className='search-box'
          placeholder='Search in description fields...'
          autoFocus
          value={ this.state.inputValue }
          onChange={ this.updateInputValue.bind(this) }
          onKeyUp={ this.queryInputValue.bind(this) }/>
        <div className='tip'>Navigation: Shift+Up/Down | Select: Shift+Enter</div>
        <ListGroup className='result-group'>
          { this.renderSearchResults() }
        </ListGroup>
      </div>
    )
  }

  render () {
    return (
      <div className='search-modal'>
        <Modal.Dialog bsSize='large'>
          <Modal.Body>
            { this.renderSearchModalBody() }
          </Modal.Body>
        </Modal.Dialog>
      </div>
    )
  }
}

function mapStateToProps (state) {
  return {
    searchWindowStatus: state.authWindowStatus,
    userSessionStatus: state.userSession.activeStatus,
    gists: state.gists
  }
}

function mapDispatchToProps (dispatch) {
  return bindActionCreators({
    selectGistTag: selectGistTag,
    selectGist: selectGist,
    fetchSingleGist: fetchSingleGist,
    updateSearchWindowStatus: updateSearchWindowStatus
  }, dispatch)
}

export default connect(mapStateToProps, mapDispatchToProps)(SearchPage)
