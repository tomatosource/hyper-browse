const { execSync } = require('child_process');

function detectCommand(data) {
	const patterns = [
		'zsh: command not found: browse.*',
		'browse.*: command not found',
		'browse.*: No such file or directory',
		'command not found: browse.*',
		'Unknown command \'browse.*\'',
		'\'browse.*\' is not recognized*',
	];
	return new RegExp('(' + patterns.join(')|(') + ')').test(data)
}

exports.decorateTerm = (Term, { React, notify }) => {
	return class extends React.Component {
		constructor(props, context) {
			super(props, context);
			this._originCursorColor = props.cursorColor;
			this._term = null;
			this._cursorFrame = null;
			this.onDecorated = this.onDecorated.bind(this);
			this.onCursorMove = this.onCursorMove.bind(this);
			this.uid = props.uid;
		}

		onDecorated(term) {
			if (term === null) return;
			if (this.props.onDecorated) this.props.onDecorated(term);
			this._term = term;
			this._term.termRef.addEventListener(
				'keyup', event => this.handleKeyUp(event),
				false
			);
		}

		onCursorMove (cursorFrame) {
			if (this.props.onCursorMove) this.props.onCursorMove(cursorFrame);
			this._cursorFrame = cursorFrame;
		}

		removeImageView() {
			let imgView = document.getElementById(`browse-view-${this.uid}`);
			if(!imgView) return;
			store.dispatch({
				type: 'HOOK_COMMAND',
				isCalledCommand: false,
				activeUid: this.props.uid,
				filePath: '',
				cursorColor: this._originCursorColor,
			});
		}

		handleKeyUp(event) {
			const {keyCode} = event;
			if (event.key == 'c' && event.ctrlKey) {
				this.removeImageView();
			}
		}

		createImageView() {
			if (!this.props.myState[this.uid] || !this.props.myState[this.uid].isCalledCommand || this._cursorFrame === null) return null;
			const { x, y } = this._cursorFrame;
			const origin = this._term.termRef.getBoundingClientRect();
			return React.createElement(
				'div',
				{
					style: {
						position: 'absolute',
						top: 0,
						left: 0,
						height: '100%',
						width:'100%',
					},
					id: `browse-view-${this.uid}`
				},
				React.createElement(
					'div',
					{
						style: {
							position: 'absolute',
							top: 0,
							right: 0,
							height: '15px',
							width:'15px',
							background: 'red',
						},
						onClick: () => {
							this.removeImageView();
						},
					},
				),
				React.createElement(
					'iframe',
					{
						style: {
							top: 0,
							left: 0,
							height: '100%',
							width:'100%',
						},
						src: this.props.myState[this.uid].url,
					},
				),
			);
		}

		render () {
			if (this.props.myState === undefined) {
				return React.createElement( Term, Object.assign({}, this.props, {
					onDecorated: this.onDecorated,
					onCursorMove: this.onCursorMove,
				}));
			}

			const children = [
				React.createElement(
					Term,
					Object.assign({}, this.props, {
						onDecorated: this.onDecorated,
						onCursorMove: this.onCursorMove,
						cursorColor: this.props.myState.cursorColor,
					})),
				this.createImageView(),
			];

			return React.createElement(
				'div',
				{
					style: {
						width: '100%',
						height: '100%',
					},
				},
				children
			)
		}
	}
}

/**
 * Get history path of login shell.
 *
 * @return string
 */
function getHistoryPath() {
	let shell = execSync('echo $SHELL').toString();
	if (new RegExp('zsh').test(shell)) {
		return '~/.zsh_history';
	} else if (new RegExp('bash').test(shell)) {
		return '~/.bash_history';
	} else if (new RegExp('fish').test(shell)) {
		return '~/.local/share/fish/fish_history';
	}
}

function getUrl(data) {
	let lines = data.split('\n');
	let x = '';
	console.log("ASDA");
	lines.forEach(l => {
		if (detectCommand(l)) {
			let prefix = "bash: browse:"
			let suffix = ": No such file or directory "
			console.log(l);
			x=  l.slice(prefix.length, l.length - suffix.length);
			console.log(x);
		}
	});
	return x;
}

exports.middleware = store => next => (action) => {
	if (action.type === 'SESSION_ADD_DATA') {
		const { data } = action;
		if (detectCommand(data)) {
			const { activeUid } = store.getState().sessions
			store.dispatch({
				type: 'HOOK_COMMAND',
				isCalledCommand: true,
				url: getUrl(data),
				activeUid,
				cursorColor: 'rgba(0,0,0,0.0)',
			});
		} else {
			next(action);
		}
	}else {
		next(action);
	}
}

exports.reduceUI = (state, action) => {
	switch (action.type) {
		case 'HOOK_COMMAND':
			console.log(action.url);
			return state.set('myState', {
				[action.activeUid]: {
					isCalledCommand : action.isCalledCommand,
					filePath: action.filePath,
					cursorColor: action.cursorColor,
					activeUid: action.activeUid,
					url: action.url,
				}
			});
	}
	return state;
};

exports.mapTermsState = (state, map) => Object.assign(map, {
	myState: state.ui.myState,
});

const passProps = (uid, parentProps, props) => Object.assign(props, {
	myState: {...parentProps.myState, uid}
})

exports.getTermGroupProps = passProps;
exports.getTermProps = passProps;
