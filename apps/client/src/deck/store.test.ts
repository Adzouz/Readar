import { describe, expect, it } from 'vitest'
import { createDeckStore } from './store'
import type { Item, Topic } from './types'

const topics: Topic[] = [
  { id: 't1', name: 'One', emoji: '1️⃣', hue: '#000000' },
  { id: 't2', name: 'Two', emoji: '2️⃣', hue: '#000000' },
]

const item = (id: string, topicId: string): Item => ({
  id,
  topicId,
  type: 'article',
  source: 'Source',
  url: 'https://example.com',
  age: '1h',
  length: '1 min read',
  title: id,
  tldr: '',
  points: [],
  why: '',
  signal: 1,
  alsoCoveredBy: 0,
  colors: ['#000000', '#ffffff'],
})

const setup = () =>
  createDeckStore({ topics, items: [item('a', 't1'), item('b', 't1'), item('c', 't2')] })

describe('deck store', () => {
  it('load swaps the followed topics, keeps decided cards out and keeps a valid view', () => {
    const deck = setup()
    deck.getState().decide('like')
    deck.getState().load([topics[1] as Topic, topics[0] as Topic])
    let state = deck.getState()
    expect(state.queues).toEqual({ t2: ['c'], t1: ['b'] })
    expect(state.totals).toEqual({ t2: 1, t1: 2 })
    expect(state.view).toEqual({ kind: 'topic', id: 't1' })
    expect(state.lists.liked).toEqual(['a'])

    deck.getState().load([topics[1] as Topic])
    state = deck.getState()
    expect(state.view).toEqual({ kind: 'topic', id: 't2' })
    // Undoing a card from a topic no longer followed takes it off the list only.
    expect(state.undo()?.id).toBe('a')
    expect(deck.getState().lists.liked).toEqual([])
    expect(deck.getState().queues).toEqual({ t2: ['c'] })
  })

  it('moves the top card of the current topic to the matching list', () => {
    const deck = setup()
    deck.getState().decide('like')
    deck.getState().decide('nope')
    const { lists, queues } = deck.getState()
    expect(lists.liked).toEqual(['a'])
    expect(lists.dismissed).toEqual(['b'])
    expect(queues.t1).toEqual([])
    expect(queues.t2).toEqual(['c'])
  })

  it('does nothing when the topic is empty', () => {
    const deck = setup()
    deck.getState().decide('like')
    deck.getState().decide('like')
    expect(deck.getState().decide('like')).toBeUndefined()
    expect(deck.getState().lists.liked).toEqual(['a', 'b'])
  })

  it('undo puts the last card back on top of its topic and switches to it', () => {
    const deck = setup()
    deck.getState().decide('later')
    deck.getState().select({ kind: 'list', id: 'later' })
    expect(deck.getState().undo()?.id).toBe('a')
    const { lists, queues, view, history } = deck.getState()
    expect(lists.later).toEqual([])
    expect(queues.t1).toEqual(['a', 'b'])
    expect(view).toEqual({ kind: 'topic', id: 't1' })
    expect(history).toEqual([])
  })

  it('undo with no history returns nothing', () => {
    expect(setup().getState().undo()).toBeUndefined()
  })

  it('restores a dismissed card and forgets it in the undo history', () => {
    const deck = setup()
    deck.getState().decide('nope')
    deck.getState().restore('a')
    const { lists, queues, history } = deck.getState()
    expect(lists.dismissed).toEqual([])
    expect(queues.t1).toEqual(['a', 'b'])
    expect(history).toEqual([])
  })

  it('marks a read-later card as read', () => {
    const deck = setup()
    deck.getState().decide('later')
    deck.getState().markRead('a')
    expect(deck.getState().lists.later).toEqual([])
    expect(deck.getState().undo()).toBeUndefined()
  })
})
