export const query = `
 query {
    metaobjectByHandle(handle: {handle: "price-drop-main-value", type: "price_drop"}) {
      displayName
      fields {
        key
        value
      }
    }
 }
`;