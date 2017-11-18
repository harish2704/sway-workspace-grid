#!/usr/bin/env node
var _exec = require('child_process').execSync;

function exec( cmd ){
  console.log( 'exec: ', cmd );
  return _exec( cmd );
}

function getSwayInfo( cmd ){
  return JSON.parse( exec(`swaymsg -t ${cmd}`) );
}

/**
 *  Workspace Manager
 */
function WpManager( Rows, Cols, monitorCount ){
  var w = 0,
    workspaces = [];
  for (r = 0; r < Rows; r++) {
    for (c = 0; c < Cols; c++) {
      workspaces.push( {
        left: c !== 0 && w-1,
        right: ( c+1 ) !== Cols && w+1,
        up: r!==0 && w-Cols,
        down: (r+1)!==Rows && w+Cols,
      });
      w++;
    }
  }
  this.workspaces = workspaces;
  this.Rows = Rows;
  this.Cols = Cols;
  this.monitorCount = monitorCount;
}

/**
 *  Workspace grid initialisation command generator.
 *  Currenlty not working because `Workspace` command will not work through `swaymsg`.
 *  it will work only if we put these commands on config file
 */
WpManager.prototype.getInitCmd = function(){
  var outputs = getSwayInfo('get_outputs').map(v => v.name ),
    outputCout = outputs.length,
    totalWorkspaces = this.Rows * this.Cols,
    cmd = [];

  for( ws = 0; ws<totalWorkspaces; ws++ ){
    for ( op = 0; op<outputCout; op++ ) {
      cmd.push(`workspace ${( ws*outputCout ) + op+1 } output ${outputs[op]}` );
    }
  }
  return cmd.join('; ');
};

/**
 * Return the list of target workspaces.
 *
 * Given current focused workspace and switching direction. eg: ( 1, down )
 * for a 3x3 grid in a dual monitor, it will reutrn [ 7, 8 ].
 * for single monitor setup, it will return [ 4 ]
 * For three monitor setup, it will return [ 10, 11, 12 ]
 *
 * @param current - current monitor
 * @param dir - direction up|down|right|left
 * @returns {Array<Number>} - list of target workspaces
 */
WpManager.prototype.getWorkspaces = function( current, dir ){
  var monitorCount = this.monitorCount, out=[], i;
  var targetw = this.workspaces[ Math.ceil( current/monitorCount ) - 1 ][dir];
  if( targetw !== false ){
    targetw = targetw*monitorCount;
    for (i = monitorCount; i !== 0; i--) {
      out.push( targetw+i );
    }
    return out;
  }
};

/**
 * Get swaymsg command for switching current Workspace to <dir> direction
 *
 * @param swayWorkspace
 * @param dir
 * @param isMove
 * @returns {String} - swaymsg command
 */
WpManager.prototype.getCmd = function( swayWorkspace, dir, isMove ){
  var currentWS = swayWorkspace.num, currentOutput = swayWorkspace.output;

  var ws = this.getWorkspaces( currentWS, dir );
  if(!ws){
    return ;
  }
  var out = ws.map( v => `workspace ${v}` );
  if( isMove ){
    var tws= ws[ currentWS%this.monitorCount];
    out.unshift( `move container to workspace ${ tws }` );
  }
  out.push( `focus output ${ currentOutput }` );
  return out.join('; ');
};


function main(){
  var dir = process.argv[2],
    isMove=false,
    ROWS=3,
    COLS=3,
    wm,
    cmd,
    outputInfo,
    workspaceInfo;

  if( dir === '-m' ){
    isMove=true;
    dir = process.argv[3];
  }
  if( [ 'up', 'down', 'right', 'left' ].indexOf( dir ) === -1 ){
    console.log([
      'Usage:',
      '\tsway-wp-switch [ -m ] <up|down|right|left>',
      '\n',
      'Options:',
      '\t-m\t move current window to new workspace while switching'
    ].join('\n'));
    return;
  }

  outputInfo = getSwayInfo('get_outputs');
  wm = new WpManager( ROWS, COLS, outputInfo.length );
  if( dir === '-i' ){
    cmd = wm.getInitCmd();
  } else {
    workspaceInfo = getSwayInfo('get_workspaces').find( v=>v.focused );
    cmd = wm.getCmd( workspaceInfo, dir, isMove);
  }

  if( cmd ){
    exec(`swaymsg -t command "${cmd}"`);
  }
}


main();
