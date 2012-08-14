// This is a temp view to get the router working
// remove later, testing basic routing in App

YUI.add("juju-status", function(Y) {

var     views = Y.namespace("juju.views");
            

StatusView = Y.Base.create('StatusView', Y.View, [], {

    initializer: function () {
        var template_src = Y.one("#t-status").getHTML();
        this.template = Y.Handlebars.compile(template_src); 
    },

    render: function () {
        var container = this.get('container'),
            m = this.get('domain_models'),
            charmData;

        charmData = m.charms.map(function (charm) {
            var data = charm.toJSON();
            console.log(charm, data);
            // Add `clientId` to the data, this is ignored by `toJSON()`. This
            // will be used by the template and is an easy way to regain access
            // to the associated Repo model.
            data.clientId = charm.get('clientId');
            return data;
        });

        container.setHTML(this.template({
            charms: charmData
        }));
        return this;
    }
});

views.status = StatusView;
}, "0.1.0", {
    requires: ['base-build', 'handlebars', 'node', "view", "json-stringify"]
});