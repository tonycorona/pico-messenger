Ext.define('GS.store.Sessions', {
  extend: 'Ext.data.Store',

  config: {
    model: "GS.model.Session",

    proxy: {
      type: 'localstorage',
      id: 'sessions'
    },

    autoLoad: true
  }
});
