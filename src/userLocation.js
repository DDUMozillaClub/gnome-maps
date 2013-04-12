/*
 * Copyright (c) 2011, 2012, 2013 Red Hat, Inc.
 *
 * GNOME Maps is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * GNOME Maps is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with GNOME Maps; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 *
 * Author: Zeeshan Ali (Khattak) <zeeshanak@gnome.org>
 */

const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Champlain = imports.gi.Champlain;
const Geocode = imports.gi.GeocodeGlib;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const MapLocation = imports.mapLocation;
const Utils = imports.utils;
const Path = imports.path;
const _ = imports.gettext.gettext;

const UserLocation = new Lang.Class({
    Name: 'UserLocation',
    Extends: MapLocation.MapLocation,

    show: function(animate, layer) {
        if (this.accuracy == Geocode.LOCATION_ACCURACY_UNKNOWN)
            return;

        this.goTo(animate);

        layer.remove_all();

        let locationMarker = new Champlain.CustomMarker();
        try {
            let pixbuf = GdkPixbuf.Pixbuf.new_from_file(Path.ICONS_DIR + "/pin.svg");
            let image = new Clutter.Image();
            image.set_data(pixbuf.get_pixels(),
                           Cogl.PixelFormat.RGBA_8888,
                           pixbuf.get_width(),
                           pixbuf.get_height(),
                           pixbuf.get_rowstride());

            locationMarker.set_location(this.latitude, this.longitude);
            locationMarker.set_reactive(false);
            // FIXME: Using deprecated function here cause I failed to get the same result
            //        with locationMarker.set_pivot_point(0.5, 0).
            locationMarker.set_anchor_point_from_gravity(Clutter.Gravity.SOUTH);
            let actor = new Clutter.Actor();
            actor.set_content(image);
            actor.set_size(pixbuf.get_width(), pixbuf.get_height());
            locationMarker.add_actor(actor);
        } catch(e) {
            log("Failed to load image: " + e.message);
            return;
        }

        if (this.accuracy == 0) {
            layer.add_marker(locationMarker);
            return;
        }

        // FIXME: Perhaps this is a misuse of Champlain.Point class and we
        // should draw the cirlce ourselves using Champlain.CustomMarker?
        // Although for doing so we'll need to add a C lib as cairo isn't
        // exactly introspectable.
        let accuracyMarker = new Champlain.Point();
        accuracyMarker.set_color(new Clutter.Color({ red: 0,
                                                     blue: 255,
                                                     green: 0,
                                                     alpha: 50 }));
        accuracyMarker.set_location(this.latitude, this.longitude);
        accuracyMarker.set_reactive(false);

        let allocSize = Lang.bind(this,
            function(zoom) {
                let source = this._view.get_map_source();
                let metersPerPixel = source.get_meters_per_pixel(zoom,
                                                                 this.latitude,
                                                                 this.longitude);
                let size = this.accuracy / metersPerPixel;
                let viewWidth = this._view.get_width();
                let viewHeight = this._view.get_height();
                // Ensure we don't endup creating way too big texture/canvas,
                // otherwise we easily end up with bus error
                if ((viewWidth > 0 && viewHeight > 0) &&
                    (size > viewWidth && size > viewHeight))
                    // Pythagorean theorem to get diagonal length of the view
                    size = Math.sqrt(Math.pow(viewWidth, 2) + Math.pow(viewHeight, 2));

                accuracyMarker.set_size(size);
            });
        let zoom = Utils.getZoomLevelForAccuracy(this.accuracy);
        allocSize(zoom);
        layer.add_marker(accuracyMarker);
        layer.add_marker(locationMarker);

        if (this._zoomLevelId > 0)
            this._view.disconnect(this._zoomLevelId);
        this._zoomLevelId = this._view.connect("notify::zoom-level", Lang.bind(this,
            function() {
                let zoom = this._view.get_zoom_level();
                allocSize(zoom);
            }));
    },
});
