import { deckStore } from '@/deck/store'
import { followedTopics, useSetup } from './store'

/** Keeps the deck's topics in line with the user's setup, now and after every edit. */
export function connectDeckToSetup(): () => void {
  deckStore.getState().load(followedTopics(useSetup.getState()))
  return useSetup.subscribe((state, previous) => {
    if (state.topicIds !== previous.topicIds || state.keywords !== previous.keywords) {
      deckStore.getState().load(followedTopics(state))
    }
  })
}
