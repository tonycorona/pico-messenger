var BOSH_SERVICE = '/xmpp-httpbind';

Ext.define('GS.controller.Main', {
  extend: 'Ext.app.Controller',

  config: {
    refs: {
      main: 'main',
      sessionContainer: 'sessioncontainer',
      compose: 'compose',
      login: 'login',
      loginButton: 'login #loginButton',
      registerButton: 'login #registerButton'
    },

    control: {
      main: {
        push: 'onMainPush',
        pop: 'onMainPop',
      },


      // TODO ondemand register.
      compose: {
        send: 'onComposeSend'
      },
      sessionContainer: {
        send: 'onComposeSend'
      },
      sessions: {
        initialize: 'initSessions',
        itemtap: 'onSessionTap'
      },
      sessionMessageField: {
        keyup: "onMessageFieldChange"
      },
      composeMessageField: {
        keyup: "onMessageFieldChange"
      },
      composePeerField: {
        keyup: "onPeerFieldChange"
      },
      sendMessageButton: {
        tap: 'onSendMessageButtonTap'
      },
      sendSessionMessageButton: {
        tap: 'onSendSessionMessageButtonTap'
      },
      sendComposeMessageButton: {
        tap: 'onSendComposeMessageButtonTap'
      },
      composeButton: {
        tap: 'onComposeButtonTap'
      },
      login: {
        show: 'onLoginShow'
      },
      loginButton: {
        tap: 'onLoginButtonTap'
      }
    }
  },

  // Peer of current active session.
  activePeer: '',
  activeNavItem: undefined,

  // current active credential(local side, username/password).
  activeCred: null,

  xmppConnection: undefined,

  // @overide
  onLoginShow: function() {

    var me = this;

    // Fetch credential from localStorage.
    me.activeCred = JSON.parse(localStorage.getItem('account'));

    if (!me.activeCred) return;

    console.log('auto login with ' + me.activeCred.username);
    // Auto login.
    me.doLogin(me.activeCred);
  },

  onMainPush: function(view, item) {

    this.updateNavBar();
  },

  onMainPop: function(view, item) {

    if (item.xtype == 'session') {

      // Reset active peer.
      this.activePeer = '';
    }

    this.updateNavBar();
  },

  // Update navigation bar accroding to currentView.
  updateNavBar: function() {

    var x = this.getMain().getActiveItem().xtype,
        editSessionsButton = this.getEditSessionsButton(),
        editMessagesButton = this.getEditMessagesButton(),
        composeButton = this.getComposeButton();

    if (x == this.activeNavItem)
      return;

    // Update activeNavItem.
    this.activeNavItem = x;

    console.log('nav: ' + x);

    if (x == "sessionlist") {

      editMessagesButton.hide();
      editSessionsButton.show();
      composeButton.show();

    } else if (x == "sessioncompose") {

      editMessagesButton.hide();
      editSessionsButton.hide();
      composeButton.hide();
    } else if (x == "session") {

      editMessagesButton.show();
      editSessionsButton.hide();
      composeButton.hide();
    }
  },

  initSessions: function() {
    this.messageStore = Ext.getStore('SessionMessages');
    this.messageStore.load({
      callback: this.onSessionMessagesStoreLoad,
      scope: this,
    });
  },
  
  onXmppMessage: function(msg) {
    var to = msg.getAttribute('to');
    var from = msg.getAttribute('from');
    var type = msg.getAttribute('type');
    var elems = msg.getElementsByTagName('body');

    if (type == "chat" && elems.length > 0) {

      var text = Strophe.getText(elems[0]),
          peer = from.split('/')[0];

	    console.log('recv from: ' + peer + ' ' + text);

      GS.app.getController('Sessions')
        .saveMessage({ peer: peer, direction: 'rx', text: text});
    }

    return true;
  },

  initSession: function() {
    this.messageStore.addAfterListener('addrecords',
        this.onMessageStoreAddRecords, this, {delay:200});
    console.log('init');
  },

  onMessageStoreAddRecords: function() {
    console.log('onadd');

    // Scroll to bottom.
    var scroller = this.getMessageList().getScrollable().getScroller();
    
    scroller.scrollToEnd();
  },

  switchSession: function(session) {

    var peer = session.get('peer'),
        session_id = session.get('id');

    // Update active session.
    this.activePeer = peer;

    // TODO: reuse
    //if (!this.session) {
    this.session = Ext.widget('session');
    //}
    //
    this.session.setTitle(peer);
    this.getSessionContainer().push(this.session)

    this.messageStore.filter('session_id', session_id);

    console.log("active session: " + peer);
  },

  // Show session detail and load the messages.
  onSessionTap: function(list, idx, el, record) {

    if (this.sessionTaped) return;
    this.seesionTaped = true;
    this.switchSession(record);
  },

  // The SessionMessage is loaded. show them.
  onSessionMessagesStoreLoad: function(records, operation, success) {

    console.log("messagestore: " + records.length + ' loaded');

    if (records.length == 0) {
      return;
    }
  },

  saveMessage: function(msg) {

    var sessionStore = Ext.getStore('Sessions'),
        idx = sessionStore.findExact('peer', msg.peer.toLowerCase()),
        session, session_id;

    if (idx == -1) {

      session = sessionStore.add({ peer: msg.peer.toLowerCase()})[0];
      console.log("Create new seesion ");
      sessionStore.sync();
    } else {
      session = sessionStore.getAt(idx);
    }

    session_id = session.get('id');

    // Update message.
    msg.session_id = session_id;
    msg.time = new Date();

    // TODO validate message.

    this.messageStore.add(msg);
    this.messageStore.sync();

    return session;
  },

  onSendSessionMessageButtonTap: function(btn) {

    var messageField = this.getSessionMessageField(),
        sendButton = this.getSendSessionMessageButton(),
        peer = this.activePeer,
        text = messageField.getValue();

    this.saveMessage({ peer: peer, direction: 'tx', text: text});
    this.sendXmppMessage(peer, text);

    // Reset if success.
    messageField.reset();
    sendButton.disable(); 
  },

  onSendComposeMessageButtonTap: function(btn) {

    var text = btn.getParent().child('#messageField').getValue(),
        peer = this.getComposePeerField().getValue(),
        msg, session;

    msg = {
      peer: peer,
      direction: 'tx',
      text: text
    };

    session = this.saveMessage(msg);
    this.sendXmppMessage(peer, text);

    this.redirectToSession(session);
  },

  redirectToSession: function(session) {

    this.getSessionContainer().pop();
    this.getMain().setActiveItem(0);
    this.switchSession(session);
  },

  sendXmppMessage: function(peer, text) {

    console.log('send to ' + peer + ': ' + text);

    var msg = $msg({
      from: this.activeCred.username,
      to: peer
      })
      .cnode(Strophe.xmlElement('body'))
      .t(text);

    this.xmppConnection.send(msg.tree());
  },

  // Compose new message.
  onComposeButtonTap: function() {
    
    this.compose = Ext.widget('sessioncompose');

    this.getMain().push(this.compose);
  },
  
  onMessageFieldChange: function(field) {

    var text = field.getValue(),
        button = field.getParent().child('#sendMessageButton');

    if (text != '' && this.activePeer != '') {
      button.enable();
    } else {
      button.disable();
    }
  },

  onPeerFieldChange: function(field) {

    var messageField = this.getComposeMessageField();

    this.activePeer = field.getValue();

    // Trigger message field validation.
    messageField.fireEvent('keyup', messageField);
  },

  onXmppConnect: function(status) {

    var me = GS.app.getController('Main'),
        viewport = Ext.Viewport;

    if (status == Strophe.Status.CONNECTING) {
      console.log('Strophe is connecting.');
    } else if (status == Strophe.Status.CONNFAIL) {

      viewport.setMasked(false);
      me.activeCred = null;

      console.log('Strophe failed to connect.');
    } else if (status == Strophe.Status.DISCONNECTING) {
	    console.log('Strophe is disconnecting.');
    } else if (status == Strophe.Status.DISCONNECTED) {
      viewport.setMasked(false);
      me.activeCred = null;

      console.log('Strophe is disconnected.');
    } else if (status == Strophe.Status.CONNECTED) {

      viewport.setMasked(false);

	    me.xmppConnection.send($pres().tree());
	    me.xmppConnection.addHandler(me.onXmppMessage, null, 'message', null, null,  null); 

      // Remove login FormPanel, and activate TabPanel.
      viewport.removeAll(true, false);
      viewport.setActiveItem({ xtype: 'main' });

      // Save credential persist.
      localStorage.setItem('account', JSON.stringify(me.activeCred));

      console.log('Strophe is connected. ' + me.activeCred.username);
    }
  },

  doLogin: function(cred) {

    var me = GS.app.getController('Main');

    // Disable UI to prevent interaction with users.
    //Ext.Viewport.setHidden(true);
    Ext.Viewport.setMasked({xtype: 'loadmask', message: 'Logging in...'});

    // Save current credential.
    me.activeCred = { 
      username: cred.username,
      password: cred.password
    };

    me.xmppConnection = new Strophe.Connection(BOSH_SERVICE);
    me.xmppConnection.connect(cred.username, cred.password,
        me.onXmppConnect);
  },

  onLoginButtonTap: function(btn) {

    var me = this,
        cred = me.getLogin().getValues();
    console.log(cred);

    if (cred.username != '' && cred.password != '') {

      me.doLogin(cred);
    }
  },

  onComposeSend: function(msg) {
    console.log('recv' + msg);

    // Update Message.
    msg.direction = 'tx';

    session = this.saveMessage(msg);
    this.sendXmppMessage(msg.peer, msg.text);

    this.redirectToSession(session);
  }


});
