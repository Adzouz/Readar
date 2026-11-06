/** What a user did with an item. No row means the item is still in their deck. */
export type ItemState = 'liked' | 'later' | 'dismissed' | 'read'

export const ITEM_STATES: readonly ItemState[] = ['liked', 'later', 'dismissed', 'read']

/** Content types a card can show. */
export type ContentType = 'article' | 'video' | 'thread' | 'podcast'
