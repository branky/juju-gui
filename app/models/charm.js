/*
This file is part of the Juju GUI, which lets users view and manage Juju
environments within a graphical interface (https://launchpad.net/juju-gui).
Copyright (C) 2012-2013 Canonical Ltd.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License version 3, as published by
the Free Software Foundation.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranties of MERCHANTABILITY,
SATISFACTORY QUALITY, or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

/**
 * Provide the Charm and CharmList classes.
 *
 * @module models
 * @submodule models.charm
 */

YUI.add('juju-charm-models', function(Y) {

  var RECENT_DAYS = 30;

  var models = Y.namespace('juju.models');
  var charmIdRe = /^(?:(\w+):)?(?:~(\S+)\/)?(\w+)\/(\S+?)(?:-(\d+|HEAD))?$/;
  var idElements = ['scheme', 'owner', 'series', 'package_name', 'revision'];
  var simpleCharmIdRe = /^(?:(\w+):)?(?!:~)(\w+)$/;
  var simpleIdElements = ['scheme', 'package_name'];

  var parseCharmId = models.parseCharmId = function(charmId, defaultSeries) {
    if (typeof charmId === 'string') {
      var parts = charmIdRe.exec(charmId);
      var pairs;
      if (parts) {
        parts.shift(); // Get rid of the first, full string.
        pairs = Y.Array.zip(idElements, parts);
      } else if (defaultSeries) {
        parts = simpleCharmIdRe.exec(charmId);
        if (parts) {
          parts.shift(); // Get rid of the first, full string.
          pairs = Y.Array.zip(simpleIdElements, parts);
          pairs.push(['series', defaultSeries]);
        }
      }
      if (parts) {
        var result = {},
            storeId;
        Y.Array.map(pairs, function(pair) { result[pair[0]] = pair[1]; });
        storeId = [
          result.series,
          result.package_name + (result.revision ? '-' + result.revision : '')
        ];
        if (result.owner) {
          storeId.unshift('~' + result.owner);
        }
        result.storeId = storeId.join('/');
        return result;
      }
    }
  };

  /**

   Extract the recent commits into a format we can use nicely.

   @method extractRecentCommits
   @return {array} Commit objects.

  */
  var extractRecentCommits = function(revisions) {
    var commits = [];

    if (revisions) {
      Y.Array.each(revisions, function(commit) {
        commits.push({
          author: {
            name: commit.authors[0].name,
            email: commit.authors[0].email
          },
          date: new Date(commit.date),
          message: commit.message,
          revno: commit.revno
        });
      });
    }
    return commits;
  };

  /**
   * Helper to use a setter so that we can set null when the api returns an
   * empty object.
   *
   * @method unsetIfNoValue
   * @param {Object} val the Object to check if it's empty.
   *
   */
  var unsetIfNoValue = function(val) {
    if (!val || Y.Object.size(val) === 0) {
      return null;
    } else {
      return val;
    }
  };


  models.charmIdRe = charmIdRe;

  /**
   * Model to represent the Charms from the Charmworld API.
   *
   * Charms, once instantiated and loaded with data from their respective
   * sources, are immutable and read-only. This reflects the reality of how
   * we interact with them.
   *
   * Charm instances can represent both environment charms and charm store
   * charms.  A charm id is reliably and uniquely associated with a given
   * charm only within a given context: the environment or the charm store.
   *
   * Charms begin their lives with full charm ids, as provided by
   * services in the environment and the charm store:
   *
   *   `[SCHEME]:(~[OWNER]/)?[SERIES]/[PACKAGE NAME]-[REVISION]`
   *
   * With an id, we can instantiate a charm: typically we use
   * `db.charms.add({id: [ID]})`.  Finally, we load the charm's data over the
   * network using the standard YUI Model method `load`, providing an object
   * with a get_charm callable, and an optional callback (see YUI docs). The env
   * has a `get_charm` method, so, by design, it works easily:
   * `charm.load(env, optionalCallback)` The `get_charm` method must either
   * callback using the default YUI approach for this code, a boolean indicating
   * failure, and a result; or it must return what the env version does: an
   * object with a `result` object containing the charm data, or an object with
   * an `err` attribute.
   *
   * A charm's `loaded` attribute is set to true once it has all the data from
   * its environment.
   *
   * @class Charm
   * @extends {Y.Model}
   *
   */
  models.Charm = Y.Base.create('browser-charm', Y.Model, [], {
    // Only care about at most, this number of related charms per interface.
    maxRelatedCharms: 5,

    /**
     * Parse the relations ATTR from the api into specific provides/requires
     * information.
     *
     * @method _parseRelations
     * @param {String} attr the attribute to load from the relations object.
     *
     */
    _parseRelations: function(attr) {
      var relations = this.get('relations');
      if (relations && relations[attr]) {
        return relations[attr];
      } else {
        return null;
      }
    },

    /**
      Given the set of data for relatedCharms, make it compatible with the
      model api to be used in the charm-token widget, for example.

      @method _convertRelatedData
      @param {Object} data a related charm object.

     */
    _convertRelatedData: function(data) {
      return {
        // Only show the icon if it has one and the charm has been reviewed to
        // have a safe icon.
        shouldShowIcon: data.has_icon && data.is_approved,
        commitCount: parseInt(data.code_source.revision, 10),
        downloads: data.downloads,
        is_approved: data.is_approved,
        name: data.name,
        owner: data.owner,
        recent_commit_count: data.commits_in_past_30_days,
        recent_download_count: data.downloads_in_past_30_days,
        series: data.distro_series,
        storeId: data.id,
        weight: data.weight
      };
    },

    /**
     * Initializer
     *
     * @method initializer
     * @param {Object} cfg The configuration object.
     */
    initializer: function(cfg) {
      if (cfg) {
        if (cfg.downloads_in_past_30_days) {
          this.set('recent_download_count', cfg.downloads_in_past_30_days);
        }
        if (cfg.id) {
          this.set('storeId', cfg.id);
        }
        if (cfg.url) {
          this.set('id', cfg.url);
        }
      }
      var id = this.get('id'),
          parts = parseCharmId(id),
          self = this;
      if (!parts) {
        throw 'Developers must initialize charms with a well-formed id.';
      }
      this.loaded = false;
      this.on('load', function() { this.loaded = true; });
      Y.Object.each(parts, function(value, key) {
        this.set(key, value);
      }, this);
    },

    sync: function(action, options, callback) {
      if (action !== 'read') {
        throw (
            'Only use the "read" action; "' + action + '" not supported.');
      }
      if (Y.Lang.isValue(options.get_charm)) {
        // This is an env.
        options.get_charm(this.get('id'), function(response) {
          if (response.err) {
            callback(true, response);
          } else if (response.result) {
            callback(false, response.result);
          } else {
            // What's going on?  This does not look like either of our
            // expected signatures.  Declare a loading error.
            callback(true, response);
          }
        });
      } else {
        throw 'You must supply a get_charm function.';
      }
    },

    parse: function(response) {
      var data = models.Charm.superclass.parse.apply(this, arguments),
          self = this;

      //Data can come from two places; a Charm being deployed into the
      //environment, or a charm already in the environment. They have slightly
      //different attributes.
      if (data.config) {
        // If data has a 'config' attribute, we're dealing with data from the
        // environment.
        data.options = data.config.options;
        data.relations = {
          requires: data.requires,
          provides: data.provides
        };
        data.is_subordinate = data.subordinate;
        delete data.config;
        delete data.subordinate;
        delete data.requires;
        delete data.provides;
      }
      Y.each(data, function(value, key) {
        if (!Y.Lang.isValue(value) ||
            !self.attrAdded(key) ||
            Y.Lang.isValue(self.get(key))) {
          delete data[key];
        }
      });
      if (data.owner === 'charmers') {
        delete data.owner;
      }
      return data;
    },

    compare: function(other, relevance, otherRelevance) {
      // Official charms sort before owned charms.
      // If !X.owner, that means it is owned by charmers.
      var owner = this.get('owner'),
          otherOwner = other.get('owner');
      if (!owner && otherOwner) {
        return -1;
      } else if (owner && !otherOwner) {
        return 1;
      // Relevance is next most important.
      } else if (relevance && (relevance !== otherRelevance)) {
        // Higher relevance comes first.
        return otherRelevance - relevance;
      // Otherwise sort by package name, then by owner, then by revision.
      } else {
        return (
                (this.get('package_name').localeCompare(
                other.get('package_name'))) ||
                (owner ? owner.localeCompare(otherOwner) : 0) ||
                (this.get('revision') - other.get('revision')));
      }
    },

    /**
      Build the relatedCharms attribute from api data

      @method buildRelatedCharms
      @param {Object} provides the list of provides interfaces/charms.
      @param {Object} requires the list of requires interfaces/charms.

    */
    buildRelatedCharms: function(provides, requires) {
      var charms = {
        all: {},
        provides: {},
        requires: {}
      };

      var buildWeightedList = function(relationName, relationData, scope) {
        Y.Object.each(relationData, function(face, key) {
          // The relations are in the order of score, so we can limit them right
          // off the bat.
          charms[relationName][key] = face.slice(0, this.maxRelatedCharms);
          charms[relationName][key].forEach(function(relation, idx) {
            // Update the related object with the converted version so that it's
            // follows the model ATTRS
            charms[relationName][key][idx] = this._convertRelatedData(relation);
            // Then track the highest provides charm to be in the running for
            // overall most weighted related charm.
            charms.all[relation.id] = charms[relationName][key][idx];
          }, scope);
        }, scope);
      };

      buildWeightedList('provides', provides, this);
      buildWeightedList('requires', requires, this);

      // Find the highest weight charms, but make sure there are no
      // duplicates. We build the object to index on key and remove dupes,
      // then we get a list of results and sort them by weight, grabbing the
      // top set.
      var allCharmsList = Y.Object.values(charms.all);

      allCharmsList.sort(function(charm1, charm2) {
        return charm2.weight - charm1.weight;
      });

      this.set('relatedCharms', {
        overall: allCharmsList.slice(0, this.maxRelatedCharms),
        provides: charms.provides,
        requires: charms.requires
      });
    }
  }, {
    /**
      Static to indicate the type of entity so that other code
      does not need to 'guess' by the entities content

      @property entityType
      @type {String}
      @default 'charm'
      @static
    */
    entityType: 'charm',
    ATTRS: {
      id: {
        validator: function(val) {
          return Y.Lang.isString(val) && !!charmIdRe.exec(val);
        }
      },
      /**
       * "id" for use with the charmworld datastore
       *
       * @attribute storeId
       * @default Undefined
       * @type {String}
       */
      storeId: {
        validator: function(val) {
          return Y.Lang.isString(val) && !!charmIdRe.exec(val);
        }
      },
      bzr_branch: {},
      categories: {
        value: []
      },
      changelog: {
        value: {}
      },
      //XXX jcsackett Aug 7 2013 This attribute is only needed until we turn
      // on the service inspector. It's just used by the charm view you get when
      // inspecting a service, and should be ripped out (along with tests) when
      // we remove that view.
      charm_path: {
        /**
         * Generate the charm store path from the attributes of the charm.
         *
         * @method getter
         *
         */
        getter: function() {
          var owner = this.get('owner');
          var revision = this.get('revision');
          revision = Y.Lang.isValue(revision) ? '-' + revision : '';
          return [
            (owner ? '~' + owner : 'charms'),
            this.get('series'),
            (this.get('package_name') + revision),
            'json'
          ].join('/');
        }
      },
      /**
       * Object of data about the source for this charm including bugs link,
       * log, revisions, etc.
       *
       * @attribute code_source
       * @default undefined
       * @type {Object}
       *
       */
      code_source: {},
      commitCount: {
        /**
         * @method commitCount.valueFn
         * @return {Integer} the revno of the branch.
         *
         */
        valueFn: function() {
          var source = this.get('code_source');
          if (source) {
            return parseInt(source.revision, 10);
          } else {
            return undefined;
          }
        }
      },
      date_created: {},
      description: {},
      'providers': {
        /**
         * @method providers.valueFn
         * @return {Array} the list of failing provider names.
         *
         */
        valueFn: function() {
          var failures = [],
              successes = [],
              providers = this.get('tested_providers');
          Y.Object.each(providers, function(value, key) {
            if (value !== 'SUCCESS') {
              failures.push(key);
            }
            else {
              successes.push(key);
            }
          });

          if (failures.length > 0 || successes.length > 0) {
            return {successes: successes, failures: failures};
          } else {
            return null;
          }
        }
      },
      /**
        @attribute downloads
        @default 0
        @type {Integer}

       */
      downloads: {
        value: 0
      },

      files: {
        value: [],
        /**
         * Sort files when they are set.
         *
         * @method files.setter
         */
        setter: function(value) {
          if (Y.Lang.isArray(value)) {
            // This sort has several properties that are different than a
            // standard lexicographic sort.
            // * Filenames in the root are grouped together, rather than
            //   sorted along with the names of directories.
            // * Sort ignores case, unless case is the only way to
            //   distinguish between values, in which case it is honored
            //   per-directory. For example, this is sorted: "a", "b/c",
            //   "b/d", "B/b", "B/c", "e/f".  Notice that "b" directory values
            //   and "B" directory values are grouped together, where they
            //   would not necessarily be in a simpler case-insensitive
            //   lexicographic sort.
            // If you rip this out for something different and simpler, that's
            // fine; just don't tell me about it. :-)  This seemed like a good
            // approach at the time.
            value.sort(function(a, b) {
              var segments = [a, b].map(function(path) {
                var segs = path.split('/');
                if (segs.length === 1) {
                  segs.unshift('');
                }
                return segs;
              });
              var maxLength = Math.max(segments[0].length, segments[1].length);
              for (var i = 0; i < maxLength; i += 1) {
                var segmentA = segments[0][i];
                var segmentB = segments[1][i];
                if (segmentA === undefined) {
                  return -1;
                } else if (segmentB === undefined) {
                  return 1;
                } else {
                  var result = (
                      // Prefer case-insensitive sort, but honor case when
                      // string match in a case-insensitive comparison.
                      segmentA.localeCompare(
                          segmentB, undefined, {sensitivity: 'accent'}) ||
                      segmentA.localeCompare(segmentB));
                  if (result) {
                    return result;
                  }
                }
              }
              return 0;
            });
          }
        }
      },
      full_name: {
        /**
         * Generate the full name of the charm from its attributes.
         *
         * @method full_name.getter
         *
         */
        getter: function() {
          // full_name
          var tmp = [this.get('series'), this.get('package_name')],
              owner = this.get('owner');
          if (owner) {
            tmp.unshift('~' + owner);
          }
          return tmp.join('/');
        }
      },
      shouldShowIcon: {
        /**
          Should this charm display its icon. Helper used for template
          rendering decisions.

          @method shouldShowIcon.valueFn
          @return {Boolean} Does the charm have an icon that should be shown?

         */
        valueFn: function() {
          var files = this.get('files') || [];
          if (!Y.Lang.isArray(files)) {
            // On some codepaths files is the list of objects and on
            // others its a mapping of filename to content.
            // XXX: Normalize handling here (without resolving root issue).
            files = Object.keys(files);
          }
          if (files.indexOf('icon.svg') !== -1 &&
              this.get('is_approved')) {
            return true;
          } else {
            return false;
          }
        }
      },
      is_approved: {},
      is_subordinate: {},
      maintainer: {},
      /*
        API related metadata information for this charm object.

        This includes information such as related charms calculated by the
        back end, but are not directly part of the charms representation.

      */
      metadata: {},
      name: {},
      /**
       * options is the parsed YAML object from config.yaml in a charm. Do not
       * set a value if there are no options to be had.
       *
       * @attribute options
       * @default undefined
       * @type {Object}
       *
       */
      options: {
        setter: unsetIfNoValue
      },
      owner: {},
      peers: {},
      proof: {},
      /**
       * This attr is a mapper to the relations ATTR in the new API. It's
       * provided for backwards compatibility with the original Charm model.
       *
       * This can be removed when juju.charmworld is the one true provider of
       * models used in all Juju Gui code.
       *
       * @attribute provides
       * @default undefined
       * @type {Object}
       *
       */
      provides: {
        /**
         * provides is a subcomponent of relations in the new api.
         *
         * @method provides.getter
         *
         */
        getter: function(value, key) {
          return this._parseRelations(key);
        }
      },
      rating_numerator: {},
      rating_denominator: {},
      /**
       * @attribute recent_commit_count
       * @default 0
       * @type {Int}
       *
       */
      'recent_commit_count': {
        /**
         * @method recent_commit_count.getter
         * @return {Int} count of the commits in 'recent' time.
         *
         */
        getter: function() {
          var count = 0,
              commits = this.get('recentCommits'),
              today = new Date(),
              recentAgo = new Date();
          recentAgo.setDate(today.getDate() - RECENT_DAYS);

          Y.Array.each(commits, function(commit) {
            if (commit.date > recentAgo) {
              count += 1;
            }
          });
          return count;
        }
      },
      /**
       * @attribute recentCommits
       * @default undefined
       * @type {Array} list of objects for each commit.
       *
       */
      recentCommits: {
        /**
         * Return the commits of the charm in a format we can live with from
         * the source code data provided by the api.
         *
         * @method recentCommits.valueFn
         *
         */
        valueFn: function() {
          var source = this.get('code_source');
          var commits = [];
          if (source) {
            commits = extractRecentCommits(source.revisions);
          }
          return commits;
        }
      },
      /**
       * Mapped from the downloads_in_past_30_days in the API.
       *
       * @attribute recent_download_count
       * @default 0
       * @type {Int} number of downloads in 'recent' time.
       *
       */
      recent_download_count: {
        value: 0
      },
      /**
        The related charms object is three parts for use in our situations.
        The keys are
        - overall: the top scored related charms regardless of interface or
                   provide/requires
        - provides: a nested object of the related charms for each provide
                    interface
        - requires: a nested object of the related charms for each require
                    interface
        @attribute relatedCharms
        @default undefined
        @type {Object}

       */
      relatedCharms: {},
      relations: {},

      /**
       * This attr is a mapper to the relations ATTR in the new API. It's
       * provided for backwards compatibility with the original Charm model.
       *
       * This can be removed when juju.charmworld is the one true provider of
       * models used in all Juju Gui code.
       *
       * @attribute requires
       * @default undefined
       * @type {Object}
       *
       */
      requires: {
        /**
         * requires is a subcomponent of relations in the new api.
         *
         * @method requires.getter
         *
         */
        getter: function(value, key) {
          return this._parseRelations(key);
        }
      },
      revision: {
        /**
         * Parse the revision number out of a string.
         *
         * @method revision.setter
         */
        setter: function(val) {
          if (val) {
            return parseInt(val, 10);
          }
        }
      },
      scheme: {
        value: 'cs',
        /**
         * If no value is given, "cs" is used as the default.
         *
         * @method scheme.setter
         */
        setter: function(val) {
          if (!Y.Lang.isValue(val)) {
            val = 'cs';
          }
          return val;
        }
      },
      series: {},

      summary: {},
      tested_providers: {},
      url: {}
    }
  });


  /**
   * CharmList is set of Charms.
   *
   * @class CharmList
   */
  models.CharmList = Y.Base.create('browserCharmList', Y.ModelList, [], {
    model: models.Charm,
    /**
      Search charms for ids in various formats. This defaults to doing a
      getById but when no match is found this will parse the charmId argument
      and attempt to match without scheme and with the default series of the
      environment (if provided.)

      @method find
      @param {String} charmId to find.
      @param {String} defaultSeries optional series to search.
      @return {Object} charm.
    */
    find: function(charmId, defaultSeries) {
      var result = this.getById(charmId);
      var partial = charmId;
      if (result) { return result; }

      if (/^(cs:|local:)/.exec(partial) !== null) {
        partial = partial.slice(partial.indexOf(':') + 1);
      }
      if (charmId.indexOf('/') === -1 && defaultSeries) {
        partial = defaultSeries + '/' + partial;
      }
      if (/\-\d+$/.exec(partial)) {
        partial = partial.slice(0, partial.indexOf('-'));
      }
      result = this.filter(function(charm) {
        return charm.get('full_name') === partial;
      });
      if (result.length === 1) {
        return result[0];
      }
      return null;
    },

    /**
      Add a charm to this model list building the model instance from the
      provided charm data.

      @method addFromCharmData
      @param {Object} metadata The charm's metadata as a YAML decoded object.
      @param {String} series The Ubuntu series for this charm.
      @param {Int} revision The charm revision number.
      @param {String} scheme The charm scheme (e.g. "cs" or "local").
      @param {Object} options Optional YAML decoded charm's config options.
      @return {Object} The resulting charm model instance.
    */
    addFromCharmData: function(metadata, series, revision, scheme, options) {
      var id = series + '/' + metadata.name + '-' + revision;
      var data = {
        categories: metadata.categories,
        description: metadata.description,
        distro_series: series,
        id: id,
        is_subordinate: metadata.subordinate,
        name: metadata.name,
        options: options,
        relations: {
          provides: metadata.provides,
          requires: metadata.requires,
          peers: metadata.peers
        },
        revision: revision,
        summary: metadata.summary,
        url: scheme + ':' + id
      };
      return this.add(data);
    }

  }, {
    ATTRS: {}
  });

  /**
    Validate the given charm metadata.
    Ensure the metadata at least includes the charm name, summary and
    description.

    @method validateCharmMetadata
    @param {Object} metadata The charm's metadata as a YAML decoded object.
    @return {Array} A list of errors in the metadata. An empty list if the
      metadata is valid.
  */
  models.validateCharmMetadata = function(metadata) {
    var errors = [];
    // According to https://juju.ubuntu.com/docs/authors-charm-metadata.html,
    // name, summary and description are the only required fields.
    ['name', 'summary', 'description'].forEach(function(name) {
      var value = metadata[name] || '';
      var stringValue = value + '';
      if (!stringValue.trim()) {
        errors.push('missing ' + name);
      }
    });
    return errors;
  };

}, '0.1.0', {
  requires: [
    'model',
    'model-list',
    'juju-charm-id'
  ]
});
