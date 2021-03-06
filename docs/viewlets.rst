=======================
Viewlets & Data Binding
=======================

The Juju GUI inspector panels are built using a light-weight custom viewlet
data-binding micro framework with four discrete components `Viewlet Manager`_,
`Viewlets`_, `Databinding Engine`_, and `Controller`_.

Viewlet Manager
===============

The Viewlet Manager is a Y.View based class which acts as a container and
viewlet manager.

How it works
------------

Upon instantiation, the Viewlet Manager creates new classes for all of the
viewlets that were passed in on configuration then waits to be explicitly
rendered to the dom by calling::

  viewletManager.render();

The render method renders the Viewlet Manager wrapper template and inserts it
into the Y.View container element. It then renders all of the viewlets and
appends them into the Viewlet Manager wrapper.


How to instantiate
------------------

The generic Viewlet Manager extends Y.View_ and as such has a similar core api
with the exception that it takes an "events" object as a configuration value on
instantiation to set up the event handlers for the Viewlet Manager template
and any non-data bound events in the viewlets.

The Viewlet Manager takes the following configuration values on instantiation:

- viewlets: Configuration for the `Viewlets`_.
- template: String or compiled Handlebars template for the Viewlet Manager. This
  must contain an element to render the viewlets into.
- templateConfig: Handlebars config object for the Viewlet Manager template.
- viewletContainer: String selector representing the element in the template to
  render the viewlets into.
- events: Passthrough to the Y.View_ event object to allow configuration on
  instantiation.

In addition to the Y.View_ methods you should look at the api docs for
Y.juju.viewlets.ViewletManager for further details regarding the configuration
options and public methods.

.. _Y.View: http://yuilibrary.com/yui/docs/api/classes/View.html

An example instantiation configuration::

  new Y.juju.viewlets.ViewletManager({
    viewlets: {
      serviceConfig: {},
      constraints: {}
    },
    template: juju.views.Templates['viewlet-manager'],
    templateConfig: {},
    container: '',
    events: {
      '.tab': {'click': function() {}}
    },
    viewletContainer: '.viewlet-container',
    model: new Y.Model({name: 'foo'})
  });


Viewlets
=========

A Viewlet is essentially a configuration object to link some DOM representation
to a `Databinding Engine`_. In practice, a Viewlet can be thought of as a very
lightweight View.

All Viewlets are rendered and hidden by default when the `Viewlet Manager`_ is
rendered. To show a viewlet you need to call the ViewletManager.showViewlet()
method passing in the viewletName which is the key name for the Viewlet
configuration in the `Viewlet Manager`_ viewlets configuration object property.

How to write viewlets
---------------------

Viewlets are passed to the `Viewlet Manager`_ on instantiation in the
`viewlets` object property and have a few configuration properties:

- name: String for user defined name of the viewlet.
- templateWrapper: String or compiled Handlebars template to use as the wrapper
  for the viewlet.
- template: String or compiled Handlebars template for the viewlet.
- bindings: An object mapping additional methods onto the binding. 'format' and
  'update' are examples. See auto-generated (yuidoc) Developer documentation.
- selectBindTarget: A function that returns a model or model list to which this
  viewlet should be bound. This was designed to return a  model or modellist
  that was nested in the model passed to the `Viewlet Manager`_ for binding.
- update: A function which is responsible for re-rendering the whole viewlet if
  the binding engine binds a modellist to the viewlet. This was designed as a
  performant technique for representing a large number of units while
  maintaining databinding to keep the UI updated.
- render: A function which receives the bound model from the `Databinding
  Engine`_ and compiles the viewlet templates. It then sets a local `container`
  property with the compiled output. This is generally only called once to set
  up the template however this could also be called by the update method.

While a viewlet doesn't explicitly require the `Viewlet Manager`_ it was
designed to be managed by a parent handler.

It is recommended that viewlets be constructed in a separate file and wrapped
in a YUI block.  In this way, viewlets can be kept separate and easy to add,
and the namespace to which they belong simply be used as a `viewlets` config
object.  These viewlets live in `app/views/viewlets`; see
`app/views/viewlets/charm-details.js` for an example of a viewlet config
object.  For example::

  // ...
  var viewletsNS = Y.namespace('juju.viewlets');

  // This can be wrapped in a feature flag if need be.
  viewletsNS.units = {
    name: 'units',
    template: Templates['unitOverview'],
    selectBindTarget: function(model) {
      return model.get('units');
    }
  };
  // ...

An example passing Viewlets into a ViewletManager is::

  var viewletsNS = Y.namespace('juju.viewlets');
  new viewletNS.ViewletManager({
    viewlets: viewletsNS
    ...
  });


Databinding Engine
==================

The Databinding Engine is the class which handles the binding between the model
passed to the `Viewlet Manager`_ and the `Viewlets`_ using the viewlet
configuration property `bindings`. See the databindings documentation.


Controller
==========

The Controller is a 100% user created class whose responsibility is to connect
the `Viewlet Manager`_ and the `Databinding Engine`_ together.
