//
// ####tessellate_rational_surface_uniform_cubic( degree_u, knots_u, degree_v, knots_v, homo_control_points, tol )
//
// Tessellate a NURBS surface given a tolerance.  The result is a uniform triangular mesh.  The surface must be >=degree 3
// in both directions.
//
// See Piegl & Richard, Tessellating Trimmed NURBS Surfaces, 1995
//
// **params**
// + *Number*, integer degree of surface in u direction
// + *Array*, array of nondecreasing knot values in u direction
// + *Number*, integer degree of surface in v direction
// + *Array*, array of nondecreasing knot values in v direction
// + *Array*, 3d array of control points, top to bottom is increasing u direction, left to right is increasing v direction,
// and where each control point is an array of length (dim+1)
// + *Number*, maximum deviation from the surface
// 
// **returns** 
// + *Array*, first element of array is an array of positions, second element are 3-tuple of triangle windings, third element is the 
// uvs
verb.eval.nurbs.tessellate_rational_surface_uniform_cubic = function( degree_u, knots_u, degree_v, knots_v, homo_control_points, tol ){

	if (degree_u < 3 || degree_v < 3) throw new Error("The surface must be degree >=3 in both directions!")

	var stepSize = verb.eval.nurbs.compute_rational_surface_max_edge_length( degree_u, knots_u, degree_v, knots_v, homo_control_points, tol );
	
	var udom = knots_u[knots_u.length-1] - knots_u[0];
	var vdom = knots_v[knots_v.length-1] - knots_v[0];

	var uSteps = (udom / stepSize) + 1;
	var vSteps = (vdom / stepSize) + 1;

	return verb.eval.nurbs.tessellate_rational_surface_naive( degree_u, knots_u, degree_v, knots_v, homo_control_points, uSteps, vSteps );

}

//
// ####compute_rational_surface_max_edge_length( degree_u, knots_u, degree_v, knots_v, homo_control_points, tol )
//
// Determine the step size for a given surface in order to be under the supplied maximum deviation
//
// **params**
// + *Number*, integer degree of surface in u direction
// + *Array*, array of nondecreasing knot values in u direction
// + *Number*, integer degree of surface in v direction
// + *Array*, array of nondecreasing knot values in v direction
// + *Array*, 3d array of control points, top to bottom is increasing u direction, left to right is increasing v direction,
// and where each control point is an array of length (dim+1)
// + *Number*, maximum deviation from the surface
// 
// **returns** 
// + *Number*, the step size to use in both directions
//
verb.eval.nurbs.compute_rational_surface_max_edge_length = function( degree_u, knots_u, degree_v, knots_v, homo_control_points, tol ){

	// using the second derivative surfaces, compute the max edge length according to (22)

	// min w * ( eps / (1 + max( len(p) ) ) )

	var nu = homo_control_points.length;
	var nv = homo_control_points[0].length;

	var maxlen = 0;

	for (var i = 0; i < nu; i++){
		for (var j = 0; j < nv; j++){
			var len = numeric.norm2( homo_control_points[i][j] );
			if (len > maxlen) maxlen = len;
		}
	}

	var denom = 1 + maxlen;
	var wi = homo_control_points[0][0].length - 1;

	var epsw = Number.MAX_VALUE;

	for (var i = 0; i < nu; i++){
		for (var j = 0; j < nv; j++){
			var wt = homo_control_points[i][j][wi];
			var val = wt * tol / denom;
			if (val < epsw) epsw = val;
		}
	}

	var d2bounds = verb.eval.nurbs.compute_rational_surface_deriv2_bounds( degree_u, knots_u, degree_v, knots_v, homo_control_points );

	// use equation (22) to determine the bounds on the surface
	return (Math.sqrt(2) / 2) *  3 * Math.sqrt( epsw / (2 * ( d2bounds[0] + d2bounds[1] + 2 * d2bounds[2])));

}

//
// ####compute_rational_surface_deriv2_bounds( degree_u, knots_u, degree_v, knots_v, homo_control_points )
//
// Compute the maximum magnitude of the second derivative on the surface.  This is done by forming the second
// derivative surfaces and inspecting the magnitudes of their control points.
//
// **params**
// + *Number*, integer degree of surface in u direction
// + *Array*, array of nondecreasing knot values in u direction
// + *Number*, integer degree of surface in v direction
// + *Array*, array of nondecreasing knot values in v direction
// + *Array*, 3d array of control points, top to bottom is increasing u direction, left to right is increasing v direction,
// and where each control point is an array of length (dim+1)
// 
// **returns** 
// + *Array*, [ maxp20, maxp02, maxp11 ]
//
verb.eval.nurbs.compute_rational_surface_deriv2_bounds = function( degree_u, u, degree_v, v, pts ){

	// we find the bounds on the second derivatives of the surface
	// by constructing second partial derivative surfaces

	// construct the second derivative surface control points according to (9), (11), (13) 
	var n = pts.length;
	var m = pts[0].length;

	// form the control points of the p20 surface
	var n2 = n-2;
	var p = degree_u;
	var pp1 = p * (p-1);

	var maxp20 = 0;

	for(var i = 0; i < n2; i++){
		for(var j = 0; j < m; j++){

			var pij = pts[i][j];
			var pi1j = pts[i+1][j];
			var pi2j = pts[i+2][j];
			
			var ptdiff1 = numeric.sub( pi2j, pi1j );
			var ptdiff2 = numeric.sub( pi1j, pij );

			var ptdiffscaled1 = numeric.mul( 1 / (u[i+p+2] - u[i+2]), ptdiff1 );
			var ptdiffscaled2 = numeric.mul( 1 / (u[i+p+1] - u[i+1]), ptdiff2 );

			var ptdiffFinal = numeric.sub( ptdiffscaled1, ptdiffscaled2 );
			var finalScale = pp1 / ( u[i+p+1] - u[i+2] );

			var max = numeric.norm2( numeric.mul( finalScale, ptdiffFinal ) );
			if (max > maxp20) maxp20 = max;
			
		}
	}

	// form the control points of the p02 surface
	var q = degree_v; 
	var qq1 = q * (q-1);
	var m2 = m - 2;

	var maxp02 = 0;

	for(var i = 0; i < n; i++){
		for(var j = 0; j < m2; j++){

			var pij = pts[i][j];
			var pij1 = pts[i][j+1];
			var pij2 = pts[i][j+2];
			
			var ptdiff1 = numeric.sub( pij2, pij1 );
			var ptdiff2 = numeric.sub( pij1, pij );

			var ptdiffscaled1 = numeric.mul( 1 / (v[j+q+2] - v[j+2]), ptdiff1 );
			var ptdiffscaled2 = numeric.mul( 1 / (v[j+q+1] - v[j+1]), ptdiff2 );

			var ptdiffFinal = numeric.sub( ptdiffscaled1, ptdiffscaled2 );
			var finalScale = qq1 / ( v[j+q+1] - v[j+2] );

			var max = numeric.norm2( numeric.mul( finalScale, ptdiffFinal ) );
			if (max > maxp02) maxp02 = max;
			
		}
	}

	// form the control points of the p11 surface
	var p11pts = [];
	var pq = p * q;
	var n1 = n - 1;
	var m1 = m - 1;

	var maxp11 = 0;

	for(var i = 0; i < n1; i++){
		for(var j = 0; j < m1; j++){

			var pij = pts[i][j];
			var pi1j = pts[i+1][j];
			var pij1 = pts[i][j+1];
			var pi1j1 = pts[i+1][j+1];
			
			var ptdiff = numeric.add( numeric.sub( numeric.sub( pi1j1, pij1 ), pi1j), pij );
			var ptdiffscaled = numeric.mul( 1 / (u[i+p+1] - u[i+1]), ptdiff );

			var finalScale = pq / (v[j+q+1] - v[j+1]);

			var max = numeric.norm2( numeric.mul( finalScale, ptdiffscaled ) );
			if (max > maxp11) maxp11 = max;
			
		}
	}

	return [maxp20, maxp02, maxp11];

}


//
// ####tessellate_rational_surface_naive( degree_u, knots_u, degree_v, knots_v, homo_control_points, divs_u, divs_v )
//
// Tessellate a nurbs surface
//
// **params**
// + *Number*, integer degree of surface in u direction
// + *Array*, array of nondecreasing knot values in u direction
// + *Number*, integer degree of surface in v direction
// + *Array*, array of nondecreasing knot values in v direction
// + *Array*, 3d array of control points, top to bottom is increasing u direction, left to right is increasing v direction,
// and where each control point is an array of length (dim+1)
// 
// **returns** 
// + *Array*, first element of array is an array of positions, second element are 3-tuple of triangle windings, third element is the 
// uvs

verb.eval.nurbs.tessellate_rational_surface_naive = function( degree_u, knots_u, degree_v, knots_v, homo_control_points, divs_u, divs_v ) {

	if ( divs_u < 1 ) {
		divs_u = 1;
	}

	if ( divs_v < 1 ) {
		divs_v = 1;
	}

	var u_span = knots_u[knots_u.length-1] - knots_u[0];
	var v_span = knots_v[knots_v.length-1] - knots_v[0];

	var span_u = u_span / divs_u,
		span_v = v_span / divs_v;
  
  var points = [];
  var uvs = [];
  var normals = [];

	for (var i = 0; i < divs_u + 1; i++) {
		for (var j = 0; j < divs_v + 1; j++) {

			var pt_u = i * span_u, 
				pt_v = j * span_v;

			uvs.push( [pt_u, pt_v] );

			var derivs = verb.eval.nurbs.rational_surface_derivs( degree_u, knots_u, degree_v, knots_v, homo_control_points, 1, pt_u, pt_v );
			var pt = derivs[0][0];

			points.push( pt );

			var normal = numeric.cross(  derivs[0][1], derivs[1][0] );
			normals.push( normal );

		}
	}

  	var faces = [];

	for (var i = 0; i < divs_u ; i++) {
		for (var j = 0; j < divs_v ; j++) {

			var a_i = i * (divs_v + 1) + j,
				b_i = (i + 1) * (divs_v + 1) + j,
				c_i = b_i + 1,
				d_i = a_i + 1,
				abc = [a_i, b_i, c_i],
				acd = [a_i, c_i, d_i];

			faces.push(abc);
			faces.push(acd);

		}
	}

	return { points: points, faces : faces, uvs: uvs, normals: normals };

}

//
// ####rational_curve_regular_sample( degree, knots, control_points, num_samples [, include_u] )
//
// Sample a NURBS curve assuming parameterization 0 to 1, corresponds to http://ariel.chronotext.org/dd/defigueiredo93adaptive.pdf
//
// **params**
// + *Number*, integer degree
// + *Array*, array of nondecreasing knot values 
// + *Array*, 1d array of homogeneous control points, where each control point is an array of length (dim+1) and form (wi*pi, wi) 
// + *Number*, integer number of samples
// 
// **returns** 
// + *Array*, an array of points, prepended by the point param
//

verb.eval.nurbs.rational_curve_regular_sample = function( degree, knots, control_points, num_samples, include_u ) {

	return verb.eval.nurbs.rational_curve_regular_sample_range( degree, knots, control_points, 0, 1.0, num_samples, include_u);

}

//
// ####rational_curve_regular_sample_range( degree, knots, control_points, start_u, end_u, num_samples, include_u )
//
// Sample a NURBS curve assuming parameterization 0 to 1, corresponds to http://ariel.chronotext.org/dd/defigueiredo93adaptive.pdf
//
// **params**
// + *Number*, integer degree
// + *Array*, array of nondecreasing knot values 
// + *Array*, 1d array of homogeneous control points, where each control point is an array of length (dim+1) and form (wi*pi, wi) 
// + *Number*, start parameter for sampling
// + *Number*, end parameter for sampling
// + *Number*, integer number of samples
// + *Boolean*, whether to prefix the point with the parameter
// 
// **returns** 
// + *Array*, an dictionary of parameter - point pairs
//

verb.eval.nurbs.rational_curve_regular_sample_range = function( degree, knots, control_points, start_u, end_u, num_samples, include_u ) {

	if (num_samples < 1){
		num_samples = 2;
	}

	var p = [],
		span = (end_u - start_u) / (num_samples - 1),
		u = 0;

	for (var i = 0; i < num_samples; i++){

		u = start_u + span * i;
		if ( include_u ){
			p.push( [u].concat( verb.eval.nurbs.rational_curve_point(degree, knots, control_points, u) ) );
		} else {
			p.push( verb.eval.nurbs.rational_curve_point(degree, knots, control_points, u) );
		}
	
	}

	return p;

}

//
// ####rational_curve_adaptive_sample( degree, knots, control_points, tol, include_u )
//
// Sample a NURBS curve assuming parameterization 0 to 1, corresponds to http://ariel.chronotext.org/dd/defigueiredo93adaptive.pdf
//
// **params**
// + *Number*, integer degree
// + *Array*, array of nondecreasing knot values 
// + *Array*, 2d array of homogeneous control points, where each control point is an array of length (dim+1) 
// and form (wi*pi, wi) 
// + *Number*, tol for the adaptive scheme
// + *Boolean*, whether to prefix the point with the parameter
// 
// **returns** 
// + *Array*, an array of dim + 1 length where the first element is the param where it was sampled and the remaining the pt
//

verb.eval.nurbs.rational_curve_adaptive_sample = function( degree, knots, control_points, tol, include_u ) {

	// if degree is 1, just return the dehomogenized control points
	if (degree === 1){ 
		if ( !include_u ) {
			return control_points.map( verb.eval.nurbs.dehomogenize );
		} else {
			// the first element of each array is the parameter
			return control_points.map(function(x, i){
				return [ knots[i+1] ].concat( verb.eval.nurbs.dehomogenize( x ) );
			});
		}
	}

	return verb.eval.nurbs.rational_curve_adaptive_sample_range( degree, knots, control_points, knots[0], knots[knots.length-1], tol, include_u );

}

//
// ####rational_curve_adaptive_sample_range( degree, knots, control_points, start_u, end_u, tol, include_u )
//
// Sample a NURBS curve at 3 points, facilitating adaptive sampling
//
// **params**
// + *Number*, integer degree
// + *Array*, array of nondecreasing knot values 
// + *Array*, 2d array of homogeneous control points, where each control point is an array of length (dim+1) 
// and form (wi*pi, wi) 
// + *Number*, start parameter for sampling
// + *Number*, end parameter for sampling
// + *Boolean*, whether to prefix the point with the parameter
// 
// **returns** 
// + *Array*, an array of dim + 1 length where the first element is the param where it was sampled and the remaining the pt
//

verb.eval.nurbs.rational_curve_adaptive_sample_range = function( degree, knots, control_points, start_u, end_u, tol, include_u ) {

	// sample curve at three pts
	var p1 = verb.eval.nurbs.rational_curve_point(degree, knots, control_points, start_u),
		p3 = verb.eval.nurbs.rational_curve_point(degree, knots, control_points, end_u),
		t = 0.5 + 0.2 * Math.random(),
		mid_u = start_u + (end_u - start_u) * t,
		p2 = verb.eval.nurbs.rational_curve_point(degree, knots, control_points, mid_u);

		// if the two end control points are coincident, the three point test will always return 0, let's split the curve
		var diff = numeric.sub( p1, p3);
		var diff2 = numeric.sub( p1, p2);

		// the first condition checks if the curve makes up a loop, if so, we will need to continue evaluation
		if ( ( numeric.dot( diff, diff ) < tol && numeric.dot( diff2, diff2 ) > tol ) || !verb.eval.nurbs.three_points_are_flat( p1, p2, p3, tol ) ) {

			// get the exact middle
			var exact_mid_u = start_u + (end_u - start_u) * 0.5;

			// recurse on the two halves
			var left_pts = verb.eval.nurbs.rational_curve_adaptive_sample_range( degree, knots, control_points, start_u, exact_mid_u, tol, include_u )
				, right_pts = verb.eval.nurbs.rational_curve_adaptive_sample_range( degree, knots, control_points, exact_mid_u, end_u, tol, include_u );

			// concatenate the two		
			return left_pts.slice(0, -1).concat(right_pts);

		} else {

			if (include_u){
				return [ 	[ start_u ].concat(p1) , [end_u].concat(p3) ];
			} else {
				return [ 	p1, p3 ];
			}

		}
}

//
// ####three_points_are_flat( p1, p2, p3, tol )
//
// Determine if three points form a straight line within a given tolerance for their 2 * squared area
//
//          * p2
//         / \
//        /   \
//       /     \ 
//      /       \
//     * p1 ---- * p3
//
// The area metric is 2 * the squared norm of the cross product of two edges, requiring no square roots and no divisions
//
// **params**
// + *Array*, p1
// + *Array*, p2
// + *Array*, p3
// + *Number*, The tolerance for whether the three points form a line
//
// **returns** 
// + *Number*, Whether the triangle passes the test
//
verb.eval.nurbs.three_points_are_flat = function( p1, p2, p3, tol ) {

	// find the area of the triangle without using a square root
	var p2mp1 = numeric.sub( p2, p1 )
		, p3mp1 = numeric.sub( p3, p1 )
		, norm = crossprod( p2mp1, p3mp1 )
		, area = numeric.dot( norm, norm );

	return area < tol;

}

function getEastNeighbor(index, i, j, min_divs_u, min_divs_v, divs){
	
	if (j === min_divs_v - 1){
		return null;
	}

	return divs[ index + 1 ];

}

function getNorthNeighbor(index, i, j, min_divs_u, min_divs_v, divs){

	if (i === 0){
		return null;
	}

	return divs[ index - min_divs_v ];

}

function getSouthNeighbor(index, i, j, min_divs_u, min_divs_v, divs){

	if (i === min_divs_u - 1){
		return null;
	}

	return divs[ index + min_divs_v ];

}

function getWestNeighbor(index, i, j, min_divs_u, min_divs_v, divs){

	if (j === 0){
		return null;
	}

	return divs[ index - 1 ];

}

verb.eval.nurbs.divide_rational_surface_adaptive = function( degree_u, knots_u, degree_v, knots_v, homo_control_points, options ) {

	// degree_u, knots_u, degree_v, knots_v, homo_control_points, 
	var srf = {
		degree_u: degree_u,
		knots_u: knots_u,
		degree_v: degree_v,
		knots_v: knots_v,
		homo_control_points: homo_control_points
	};

	var min_divs_u = options.minDivsU;
	var min_divs_v = options.minDivsV;

	// get necessary intervals
	var max_u = verb.last(knots_u);
	var min_u = knots_u[0];
	var max_v = verb.last(knots_v);
	var min_v = knots_v[0];

	var u_interval = (max_u - min_u) / min_divs_u
		, v_interval = (max_v - min_v) / min_divs_v;

	var divs = [];

	// make all of the nodes
	for (var i = 0; i < min_divs_u; i++){
		for (var j = 0; j < min_divs_v; j++){

			var u0 = min_u + u_interval * i
				, u1 = min_u + u_interval * (i + 1)
				, v0 = min_v + v_interval * j
				, v1 = min_v + v_interval * (j + 1);

		  divs.push( new verb.eval.nurbs.AdaptiveRefinementNode( srf, u0, u1, v0, v1, null, null ) );

		}
	}

	// assign all of the neighbors and divide
	for (var i = 0; i < min_divs_u; i++){
		for (var j = 0; j < min_divs_v; j++){

			var index = i * min_divs_v + j
				, n = getNorthNeighbor( index, i, j, min_divs_u, min_divs_v, divs )
				, e = getEastNeighbor( index, i, j, min_divs_u, min_divs_v, divs  )
				, s = getSouthNeighbor( index, i, j, min_divs_u, min_divs_v, divs )
				, w = getWestNeighbor( index, i, j, min_divs_u, min_divs_v, divs  );

		  divs[index].neighbors = [ n, e, s, w ];

		  divs.divide( options );

		}
	}

	return divs;

}

verb.eval.nurbs.is_rational_surface_domain_flat2 = function(srf, u0, u1, v0, v1, options ){

	var tol = options.tol != undefined ? options.tol : verb.TOLERANCE;

	var eval_srf = function(u,v){ return verb.eval.nurbs.rational_surface_point(srf.degree_u, srf.knots_u, 
																		srf.degree_v, srf.knots_v, srf.homo_control_points, u, v ); }
		, t = 0.5 + 0.2 * Math.random()
		, mid_u = u0 + (u1 - u0) * t
		, mid_v = v0 + (v1 - v0) * t
		, p1 = eval_srf( u0, v0 )
		, p2 = eval_srf( mid_u, mid_v )
		, p3 = eval_srf( u1, v1 )
		, r1 = numeric.normalized( numeric.sub( p3, p1 ) )
		, o1 = p1
		, d1 = verb.eval.geom.dist_to_ray( p2, o1, r1 );

	if ( d1 > tol ) return false;

	var t2 = 0.5 + 0.2 * Math.random()
		, mid_u1 = u0 + (u1 - u0) * t2
		, mid_v1 = v1 + (v0 - v1) * t2
		, p21 = eval_srf( u0, v1 )
		, p22 = eval_srf( mid_u1, mid_v1 )
		, p23 = eval_srf( u1, v0 )
		, r2 = numeric.normalized( numeric.sub( p23, p21 ) )
		, o2 = p21
		, d2 = verb.eval.geom.dist_to_ray( p22, o2, r2 );

	return d2 < tol;

}

verb.eval.nurbs.is_rational_surface_domain_flat = function(srf, u0, u1, v0, v1, options ){

	var tol = options.tol != undefined ? options.tol : verb.TOLERANCE;

	var eval_srf = function(u,v){ return verb.eval.nurbs.rational_surface_point(srf.degree_u, srf.knots_u, 
																		srf.degree_v, srf.knots_v, srf.homo_control_points, u, v ); }
		, t = 0.5 + 0.2 * Math.random()
		, mid_u = u0 + (u1 - u0) * t
		, mid_v = v0 + (v1 - v0) * t
		, p1 = eval_srf( u0, v0 )
		, p2 = eval_srf( mid_u, mid_v )
		, p3 = eval_srf( u1, v1 );

	if ( !verb.eval.nurbs.three_points_are_flat( p1, p2, p3, tol ) ) return false;

	// try the other diagonal
	var t2 = 0.5 + 0.2 * Math.random()
		, mid_u1 = u0 + (u1 - u0) * t2
		, mid_v1 = v1 + (v0 - v1) * t2
		, p21 = eval_srf( u0, v1 )
		, p22 = eval_srf( mid_u1, mid_v1 )
		, p23 = eval_srf( u1, v0 );

	return verb.eval.nurbs.three_points_are_flat( p21, p22, p23, tol );

}

verb.eval.nurbs.triangulate_adaptive_refinement_node_tree = function( arrTree ){

	// triangulate all of the nodes of the tree
	var mesh = { uvs : [], points : [], normals : [], faces : [] };
	mesh.faces = arrTree.map(function(x){  x.triangulate( mesh ); }).flatten();
	return mesh;

};

verb.eval.nurbs.tessellate_rational_surface_adaptive = function( degree_u, knots_u, degree_v, knots_v, homo_control_points, options ) {

	// division step
	var arrArray = verb.eval.nurbs.divide_rational_surface_adaptive( degree_u, knots_u, degree_v, knots_v, homo_control_points, options );

	// triangulation step
	return verb.eval.nurbs.triangulate_adaptive_refinement_node_tree( arrTree );

}

verb.geom.SurfacePoint = function(point, normal, uv, id){
	this.uv = uv;
	this.point = point;
	this.normal = normal;
	this.id = id;
}

verb.geom.SurfacePoint.fromUv = function(u,v){
	return new verb.geom.SurfacePoint(null, null, [u,v], null);
}

verb.geom.TriMesh = function(faces, points, uvs, normals){
	this.faces = faces;
	this.points = points;
	this.uvs = uvs;
	this.normals = normals;
}

verb.geom.TriMesh.empty = function(){
	return new verb.geom.TriMesh([],[],[],[]);
}

verb.eval.nurbs.AdaptiveRefinementNode = function( srf, corners, parentNode, neighbors ) {

	// 
	// Structure of the child nodes
	// in the adaptive refinement tree
  //      
  //  +--> u
  //  |
  //  v
  //  v
  // 
  //                        neighbors[0]
  //
	//                (u0,v0)---(u05,v0)---(u1,v0)
	//                  |           |          |
	//                  |     0     |     1    |
	//                  |           |          |
	// neighbors[3]   (u0,v05)--(u05,v05)--(u1,v05)   neighbors[1] 
	//                  |           |          | 
	//                  |     3     |     2    |
	//                  |           |          |
	//                (u0,v1)---(u05,v1)---(u1,v1)
	//
	//                        neighbors[2]
	//

	this.srf = srf;

	this.parentNode = parentNode;
	this.neighbors = neighbors || [null, null, null, null];

	// if no corners, we need to construct initial corners from the surface
	if (!corners){

		var u0 = srf ? srf.knots_u[0] : null;
		var u1 = srf ? verb.last( srf.knots_u ) : null;
		var v0 = srf ? srf.knots_v[0] : null;
		var v1 = srf ? verb.last( srf.knots_v ) : null;

		corners = [ verb.geom.SurfacePoint.fromUv( u0, v0 ),
								verb.geom.SurfacePoint.fromUv( u1, v0 ),
								verb.geom.SurfacePoint.fromUv( u1, v1 ),
								verb.geom.SurfacePoint.fromUv( u0, v1 ) ];

	}

	this.corners = corners;
	this.cachedEdgeUvs = [];

}

verb.eval.nurbs.AdaptiveRefinementNode.prototype.evalCorner = function(id){
	if ( !this.corners[id].point ){
		this.evalSrf( this.corners[id].uv[0], this.corners[id].uv[1], this.corners[id] )
	}

	return this.corners[id];
}

verb.eval.nurbs.AdaptiveRefinementNode.prototype.evalCenter = function(id){
	this.u05 = this.u05 || (this.corners[0].uv[0] + this.corners[2].uv[0]) / 2;
	this.v05 = this.v05 || (this.corners[0].uv[1] + this.corners[2].uv[1]) / 2;

	this.center = this.center || this.evalSrf( this.u05, this.v05 );

	return this.center;
}

verb.eval.nurbs.AdaptiveRefinementNode.prototype.evalCorners = function(){
	this.evalCenter();

	for (var i = 0; i < 4; i++) {
		this.evalCorner(i);
	}
}

verb.eval.nurbs.AdaptiveRefinementNode.prototype.evalMidPoints = function(){

	this.midpoints = [null, null, null, null];
	this.midpoints[0] = this.evalSrf( this.u05, this.corners[0].uv[1] );
	this.midpoints[1] = this.evalSrf( this.corners[1].uv[0], this.v05 );
	this.midpoints[2] = this.evalSrf( this.u05, this.corners[2].uv[1] );
	this.midpoints[3] = this.evalSrf( this.corners[0].uv[0], this.v05 );

}

verb.eval.nurbs.AdaptiveRefinementNode.prototype.umin = function(){
	return this.corners[0].uv[0];
};

verb.eval.nurbs.AdaptiveRefinementNode.prototype.umax = function(){
	return this.corners[2].uv[0];
};

verb.eval.nurbs.AdaptiveRefinementNode.prototype.vmin = function(){
	return this.corners[0].uv[1];
};

verb.eval.nurbs.AdaptiveRefinementNode.prototype.vmax = function(){
	return this.corners[2].uv[1];
};

verb.eval.nurbs.AdaptiveRefinementNode.prototype.isLeaf = function(){
	return this.children === undefined;
};

verb.eval.nurbs.AdaptiveRefinementNode.prototype.evalSrf = function( u, v, srfPt ){

	var derivs = verb.eval.nurbs.rational_surface_derivs( this.srf.degree_u, 
																												this.srf.knots_u, 
																												this.srf.degree_v, 
																												this.srf.knots_v, 
																												this.srf.homo_control_points, 
																												1, 
																												u, 
																												v );
	var pt = derivs[0][0];
	var norm = numeric.cross(  derivs[0][1], derivs[1][0] );

	if (srfPt){
		srfPt.point = pt;
		srfPt.normal = norm;
		return srfPt;
	} else {
		return new verb.geom.SurfacePoint( pt, norm, [u,v] );
	}

};

verb.eval.nurbs.AdaptiveRefinementNode.prototype.getEdgeUvs = function( edgeIndex ){

	// if its a leaf, there are no children to obtain uvs from
	if ( this.isLeaf() ) return [ this.corners[ edgeIndex ] ]

	// get the uvs owned by the children along this edge
	this.cachedEdgeUvs[edgeIndex] = this.cachedEdgeUvs[edgeIndex] || this.children[ edgeIndex ].getEdgeUvs( edgeIndex )
																						 												.concat( this.children[ (edgeIndex + 1) % 4 ].getEdgeUvs( edgeIndex ));
	return this.cachedEdgeUvs[edgeIndex];
};

verb.within = function(value, startRange, endRange){
	return value > startRange + verb.EPSILON && value < endRange - verb.EPSILON; 
}

verb.eval.nurbs.AdaptiveRefinementNode.prototype.getAllEdgeUvs = function( edgeIndex ){

	var baseArr = [ this.corners[edgeIndex] ];

	if ( !this.neighbors[edgeIndex] ) {
		return baseArr;
	}

	// get opposite edges uvs
	var corners = this.neighbors[edgeIndex].getEdgeUvs( ( edgeIndex + 2 ) % 4 );

	var funcIndex = edgeIndex % 2;

	var that = this;

	// range clipping functions
	var rangeFuncMap = [
		function(corner){ return verb.within( corner.uv[0], this.umin(), this.umax() ); }.bind(this),
		function(corner){ return verb.within( corner.uv[1], this.vmin(), this.vmax() ); }.bind(this),
	];

	// clip the range of uvs to match this one
	return baseArr.concat( corners.filter( rangeFuncMap[ funcIndex ] ).reverse() ) ;

};

verb.eval.nurbs.AdaptiveRefinementNode.prototype.isFlat = function(options){

	var tol = options.tol != undefined ? options.tol : verb.TOLERANCE;

	return verb.eval.nurbs.three_points_are_flat( this.corners[0].point, this.center.point, this.corners[2].point, tol ) &&
					verb.eval.nurbs.three_points_are_flat( this.corners[1].point, this.center.point, this.corners[3].point, tol );

}

verb.eval.nurbs.AdaptiveRefinementNode.prototype.triangulate = function( mesh ){

	mesh = mesh || verb.geom.TriMesh.empty();

	if ( this.isLeaf() ) return this.triangulateLeaf( mesh );

	// recurse on the children
	this.children.forEach(function(x){
		if (!x) return;
		x.triangulate( mesh );
	});

	return mesh;

};

verb.eval.nurbs.AdaptiveRefinementNode.prototype.shouldDivide = function( options, currentDepth ){

	if ( options.minDepth != undefined && currentDepth < options.minDepth){
		return true;
	} else if (options.maxDepth != undefined && options.maxDepth >= currentDepth) {
		 return false;  
	} else if ( this.srf ){
		return !this.isFlat( options );
	}

	return false;
}

verb.eval.nurbs.AdaptiveRefinementNode.prototype.divide = function( options, currentDepth ){

	// initialize currentDepth if it's not present
	if (currentDepth === undefined) currentDepth = 0;
	options = options || {};

	if ( this.srf ) this.evalCorners();

	if ( !this.shouldDivide( options, currentDepth )  ) return;

	if ( this.srf ) this.evalMidPoints();

	// increment the depth
	currentDepth++;

	var corners0 = [ this.corners[0], this.midpoints[0], this.center, this.midpoints[3] ];
	var corners1 = [ this.midpoints[0], this.corners[1], this.midpoints[1], this.center ];
	var corners2 = [ this.center, this.midpoints[1], this.corners[2], this.midpoints[2] ];
	var corners3 = [ this.midpoints[3], this.center, this.midpoints[2], this.corners[3] ];

	// create the children
	this.children = [ 	new verb.eval.nurbs.AdaptiveRefinementNode( this.srf, corners0, this ),
											new verb.eval.nurbs.AdaptiveRefinementNode( this.srf, corners1, this ),
											new verb.eval.nurbs.AdaptiveRefinementNode( this.srf, corners2, this ),
											new verb.eval.nurbs.AdaptiveRefinementNode( this.srf, corners3, this ) ];

	// correctly assign neighbors
	this.children[0].neighbors = [ this.neighbors[0], this.children[1], this.children[3], this.neighbors[3] ];
	this.children[1].neighbors = [ this.neighbors[0], this.neighbors[1], this.children[2], this.children[0] ];
	this.children[2].neighbors = [ this.children[1], this.neighbors[1], this.neighbors[2], this.children[3] ];
	this.children[3].neighbors = [ this.children[0], this.children[2], this.neighbors[2], this.neighbors[3] ];

	// divide all children recursively
	this.children.forEach(function(x){ x.divide( options,currentDepth ); })

};

verb.eval.nurbs.AdaptiveRefinementNode.prototype.triangulateLeaf = function( mesh ){

	var baseIndex = mesh.points.length;
	var uvs = [];
	var ids = [];

	// enumerate all uvs in counter clockwise direction
	for (var i = 0; i < 4; i++){
		uvs = uvs.concat( this.getAllEdgeUvs(i) ); 
	}

	uvs.forEach(function(corner){

		if (corner.id != undefined){
			return ids.push(corner.id);
		}

		mesh.uvs.push( corner.uv );
		mesh.points.push( corner.point );
		mesh.normals.push( corner.normal );

		corner.id = baseIndex;
		ids.push( baseIndex );

		baseIndex++;

	}.bind(this));

	if (uvs.length === 4){

		// if the number of points is 4, we're just doing a
		// rectangle - just build the basic triangulated square
		mesh.faces.push( [ ids[0], ids[3], ids[1] ] );
		mesh.faces.push( [ ids[3], ids[2], ids[1] ] );

		// all done 
		return mesh;
	}

	// make point at center of face
	mesh.uvs.push( this.center.uv );	
	mesh.points.push( this.center.point );
	mesh.normals.push( this.center.normal );

	// get index 
	var centerIndex = mesh.points.length - 1;

	// build triangle fan from center
	for (var i = 0, j = uvs.length-1; i < uvs.length; j = i++){
		mesh.faces.push( [	centerIndex, ids[j], ids[i]   ]);
	}

	return mesh;

};


