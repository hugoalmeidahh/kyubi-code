/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable no-restricted-globals */

(async function () {

	// Add a perf entry right from the top
	performance.mark('code/didStartRenderer');

	type ISandboxConfiguration = import('../../../base/parts/sandbox/common/sandboxTypes.js').ISandboxConfiguration;
	type ILoadResult<M, T extends ISandboxConfiguration> = import('../../../platform/window/electron-browser/window.js').ILoadResult<M, T>;
	type ILoadOptions<T extends ISandboxConfiguration> = import('../../../platform/window/electron-browser/window.js').ILoadOptions<T>;
	type INativeWindowConfiguration = import('../../../platform/window/common/window.ts').INativeWindowConfiguration;
	type IMainWindowSandboxGlobals = import('../../../base/parts/sandbox/electron-browser/globals.js').IMainWindowSandboxGlobals;
	type IDesktopMain = import('../../../workbench/electron-browser/desktop.main.js').IDesktopMain;
	type IPartsSplashPartBounds = import('../../../platform/theme/common/themeService.js').IPartsSplashPartBounds;

	const preloadGlobals = (window as unknown as { vscode: IMainWindowSandboxGlobals }).vscode; // defined by preload.ts
	const safeProcess = preloadGlobals.process;

	//#region Splash Screen Helpers

	// Kyubi Code: inline splash logo (128px PNG, base64) shown centered while the workbench loads
	const KYUBI_SPLASH_LOGO = 'data:image/png;base64,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';

	function showKyubiLogo(splash: HTMLElement) {
		const logoContainer = document.createElement('div');
		logoContainer.style.position = 'absolute';
		logoContainer.style.top = '0';
		logoContainer.style.left = '0';
		logoContainer.style.width = '100vw';
		logoContainer.style.height = '100vh';
		logoContainer.style.display = 'flex';
		logoContainer.style.alignItems = 'center';
		logoContainer.style.justifyContent = 'center';
		logoContainer.style.zIndex = '2';
		logoContainer.style.pointerEvents = 'none';

		const logo = document.createElement('img');
		logo.src = KYUBI_SPLASH_LOGO;
		logo.style.width = '96px';
		logo.style.height = '96px';
		logo.style.opacity = '0';
		logo.style.transition = 'opacity 300ms ease-in';
		logo.style.animation = 'kyubi-splash-pulse 1.6s ease-in-out 300ms infinite';

		const style = document.createElement('style');
		style.textContent = '@keyframes kyubi-splash-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.94); } }';
		logoContainer.appendChild(style);

		logoContainer.appendChild(logo);
		splash.appendChild(logoContainer);

		requestAnimationFrame(() => { logo.style.opacity = '1'; });
	}

	function showSplash(configuration: INativeWindowConfiguration) {
		performance.mark('code/willShowPartsSplash');
		showDefaultSplash(configuration);
		performance.mark('code/didShowPartsSplash');
	}

	function showDefaultSplash(configuration: INativeWindowConfiguration) {
		let data = configuration.partsSplash;
		if (data) {
			if (configuration.autoDetectHighContrast && configuration.colorScheme.highContrast) {
				if ((configuration.colorScheme.dark && data.baseTheme !== 'hc-black') || (!configuration.colorScheme.dark && data.baseTheme !== 'hc-light')) {
					data = undefined; // high contrast mode has been turned by the OS -> ignore stored colors and layouts
				}
			} else if (configuration.autoDetectColorScheme) {
				if ((configuration.colorScheme.dark && data.baseTheme !== 'vs-dark') || (!configuration.colorScheme.dark && data.baseTheme !== 'vs')) {
					data = undefined; // OS color scheme is tracked and has changed
				}
			}
		}

		// developing an extension -> ignore stored layouts
		if (data && configuration.extensionDevelopmentPath) {
			data.layoutInfo = undefined;
		}

		// minimal color configuration (works with or without persisted data)
		let baseTheme;
		let shellBackground;
		let shellForeground;
		if (data) {
			baseTheme = data.baseTheme;
			shellBackground = data.colorInfo.editorBackground;
			shellForeground = data.colorInfo.foreground;
		} else if (configuration.autoDetectHighContrast && configuration.colorScheme.highContrast) {
			if (configuration.colorScheme.dark) {
				baseTheme = 'hc-black';
				shellBackground = '#000000';
				shellForeground = '#FFFFFF';
			} else {
				baseTheme = 'hc-light';
				shellBackground = '#FFFFFF';
				shellForeground = '#000000';
			}
		} else if (configuration.autoDetectColorScheme) {
			if (configuration.colorScheme.dark) {
				baseTheme = 'vs-dark';
				shellBackground = '#1E1E1E';
				shellForeground = '#CCCCCC';
			} else {
				baseTheme = 'vs';
				shellBackground = '#FFFFFF';
				shellForeground = '#000000';
			}
		}

		const style = document.createElement('style');
		style.className = 'initialShellColors';
		window.document.head.appendChild(style);
		style.textContent = `body {	background-color: ${shellBackground}; color: ${shellForeground}; margin: 0; padding: 0; }`;

		// set zoom level as soon as possible
		if (typeof data?.zoomLevel === 'number' && typeof preloadGlobals?.webFrame?.setZoomLevel === 'function') {
			preloadGlobals.webFrame.setZoomLevel(data.zoomLevel);
		}

		// restore parts if possible (we might not always store layout info)
		if (data?.layoutInfo) {
			const { layoutInfo, colorInfo } = data;
			const modernUI = layoutInfo.modernUI === true;
			const floatingMargin = layoutInfo.modernUICompact === true ? 0 : 4;
			// The cluster perimeter is the same in both densities; only the inter-card gap differs.
			const floatingOuterMargin = 4;
			const floatingBorderWidth = 1;
			const floatingBorderRadius = 8;
			const contentTop = layoutInfo.titleBarHeight;
			const contentBottom = layoutInfo.statusBarHeight;

			const splash = document.createElement('div');
			splash.id = 'monaco-parts-splash';
			splash.className = baseTheme ?? 'vs-dark';

			if (layoutInfo.windowBorder && colorInfo.windowBorder) {
				const borderElement = document.createElement('div');
				borderElement.style.position = 'absolute';
				borderElement.style.width = 'calc(100vw - 2px)';
				borderElement.style.height = 'calc(100vh - 2px)';
				borderElement.style.zIndex = '1'; // allow border above other elements
				borderElement.style.border = `1px solid var(--window-border-color)`;
				borderElement.style.setProperty('--window-border-color', colorInfo.windowBorder);

				if (layoutInfo.windowBorderRadius) {
					borderElement.style.borderRadius = layoutInfo.windowBorderRadius;
				}

				splash.appendChild(borderElement);
			}

			const setBounds = (element: HTMLElement, bounds: { top: number; bottom?: number; left?: number; right?: number; width?: number; height?: number }) => {
				element.style.position = 'absolute';
				element.style.top = `${bounds.top}px`;
				if (typeof bounds.bottom === 'number') {
					element.style.bottom = `${bounds.bottom}px`;
				}
				if (typeof bounds.left === 'number') {
					element.style.left = `${bounds.left}px`;
				}
				if (typeof bounds.right === 'number') {
					element.style.right = `${bounds.right}px`;
				}
				if (typeof bounds.width === 'number') {
					element.style.width = `${bounds.width}px`;
				}
				if (typeof bounds.height === 'number') {
					element.style.height = `${bounds.height}px`;
				}
			};

			const setPartBounds = (element: HTMLElement, bounds: { top: number; left: number; width: number; height: number }) => {
				element.style.position = 'absolute';
				element.style.top = `${bounds.top}px`;
				element.style.left = `${bounds.left}px`;
				element.style.width = `${bounds.width}px`;
				element.style.height = `${bounds.height}px`;
			};

			const fallbackActivityBarBounds: IPartsSplashPartBounds | undefined = layoutInfo.modernUICompact === true && layoutInfo.activityBarWidth > 0 ? {
				top: contentTop + (contentTop === 0 ? floatingOuterMargin : 0),
				left: layoutInfo.sideBarSide === 'left' ? floatingOuterMargin : window.innerWidth - layoutInfo.activityBarWidth,
				width: Math.max(0, layoutInfo.activityBarWidth - floatingOuterMargin),
				height: window.innerHeight - contentTop - contentBottom - floatingOuterMargin - (contentTop === 0 ? floatingOuterMargin : 0),
			} : undefined;
			const compactPartBounds = layoutInfo.modernUICompact === true ? [
				layoutInfo.partBounds?.activityBar,
				layoutInfo.partBounds?.sideBar,
				layoutInfo.partBounds?.auxiliaryBar,
				layoutInfo.partBounds?.editor,
				layoutInfo.partBounds?.panel,
			].filter((bounds): bounds is IPartsSplashPartBounds => !!bounds) : [];
			const compactHorizontalBounds = layoutInfo.modernUICompact === true ? [
				layoutInfo.partBounds?.activityBar ?? fallbackActivityBarBounds,
				layoutInfo.partBounds?.sideBar,
				layoutInfo.partBounds?.auxiliaryBar,
				layoutInfo.partBounds?.editor,
				layoutInfo.partBounds?.panel,
			].filter((bounds): bounds is IPartsSplashPartBounds => !!bounds) : [];
			const compactClusterEdges = compactPartBounds.length > 0 && compactHorizontalBounds.length > 0 ? {
				left: Math.min(...compactHorizontalBounds.map(bounds => bounds.left)),
				right: Math.max(...compactHorizontalBounds.map(bounds => bounds.left + bounds.width)),
				top: Math.min(...compactPartBounds.map(bounds => bounds.top)),
				bottom: Math.max(...compactPartBounds.map(bounds => bounds.top + bounds.height)),
			} : undefined;

			// Without saved `partBounds` (they are cleared whenever the resolved bar widths differ
			// from the ones stored for the workspace) the cluster edges cannot be measured, so
			// derive ownership from the fallback order instead: the outermost visible card on each
			// side owns that edge, and every card spans the content region vertically.
			const fallbackClusterOrder: readonly ('activityBar' | 'sideBar' | 'editor' | 'auxiliaryBar')[] = layoutInfo.sideBarSide === 'left'
				? ['activityBar', 'sideBar', 'editor', 'auxiliaryBar']
				: ['auxiliaryBar', 'editor', 'sideBar', 'activityBar'];
			const fallbackClusterVisible = {
				activityBar: layoutInfo.activityBarWidth > 0,
				sideBar: layoutInfo.sideBarWidth > 0,
				editor: true,
				auxiliaryBar: layoutInfo.auxiliaryBarWidth > 0,
			};
			const fallbackLeftOwner = fallbackClusterOrder.find(part => fallbackClusterVisible[part]);
			const fallbackRightOwner = [...fallbackClusterOrder].reverse().find(part => fallbackClusterVisible[part]);
			const fallbackOuterEdgesFor = (part: 'activityBar' | 'sideBar' | 'editor' | 'auxiliaryBar') => ({
				left: fallbackLeftOwner === part,
				right: fallbackRightOwner === part,
				top: true,
				bottom: true,
			});
			const fallbackInsetFor = (part: 'activityBar' | 'sideBar' | 'editor' | 'auxiliaryBar', edge: 'left' | 'right' | 'top' | 'bottom') =>
				modernUI ? fallbackOuterEdgesFor(part)[edge] ? floatingOuterMargin : floatingMargin : 0;

			const railBorderColor = colorInfo.modernActivityBarBorder ?? colorInfo.surfaceBorder ?? colorInfo.agentsPanelBorder ?? colorInfo.editorGroupBorder ?? 'transparent';

			const applyFloatingCardStyles = (
				element: HTMLElement,
				backgroundColor: string | undefined,
				partBounds?: IPartsSplashPartBounds,
				fallbackOuterEdges = { left: true, right: true, top: true, bottom: true },
				compactBorderColor = colorInfo.surfaceBorder ?? colorInfo.agentsPanelBorder ?? colorInfo.editorGroupBorder ?? 'transparent'
			) => {
				element.style.boxSizing = 'border-box';
				if (layoutInfo.modernUICompact === true) {
					const outerEdges = partBounds?.outerEdges ?? (partBounds && compactClusterEdges ? {
						left: partBounds.left === compactClusterEdges.left,
						right: partBounds.left + partBounds.width === compactClusterEdges.right,
						top: partBounds.top === compactClusterEdges.top,
						bottom: partBounds.top + partBounds.height === compactClusterEdges.bottom,
					} : fallbackOuterEdges);
					element.style.borderStyle = 'solid';
					element.style.borderColor = compactBorderColor;
					element.style.borderWidth = `${outerEdges.top ? floatingBorderWidth : 0}px ${floatingBorderWidth}px ${floatingBorderWidth}px ${outerEdges.left ? floatingBorderWidth : 0}px`;
					element.style.borderRadius = [
						outerEdges.top && outerEdges.left ? floatingBorderRadius : 0,
						outerEdges.top && outerEdges.right ? floatingBorderRadius : 0,
						outerEdges.bottom && outerEdges.right ? floatingBorderRadius : 0,
						outerEdges.bottom && outerEdges.left ? floatingBorderRadius : 0,
					].map(radius => `${radius}px`).join(' ');
				} else {
					element.style.border = `${floatingBorderWidth}px solid ${colorInfo.agentsPanelBorder ?? colorInfo.editorGroupBorder ?? 'transparent'}`;
					element.style.borderRadius = `${floatingBorderRadius}px`;
				}
				element.style.backgroundColor = backgroundColor ?? colorInfo.editorBackground ?? colorInfo.background;
				element.style.overflow = 'hidden';
			};

			const contentHeight = `calc(100% - ${contentTop + contentBottom}px)`;
			const activityHeight = modernUI ? `calc(100% - ${contentTop + contentBottom + floatingMargin}px)` : contentHeight;
			const modernActivityBarBackground = (window.document.hasFocus()
				? colorInfo.modernActivityBarBackground
				: colorInfo.modernActivityBarInactiveBackground ?? colorInfo.modernActivityBarBackground)
				?? colorInfo.activityBarBackground;

			if (layoutInfo.auxiliaryBarWidth === Number.MAX_SAFE_INTEGER) {
				// if auxiliary bar is maximized, it goes as wide as the
				// window width but leaving room for activity bar
				layoutInfo.auxiliaryBarWidth = window.innerWidth - layoutInfo.activityBarWidth;
			} else {
				// otherwise adjust for other parts sizes if not maximized
				layoutInfo.auxiliaryBarWidth = Math.min(layoutInfo.auxiliaryBarWidth, window.innerWidth - (layoutInfo.activityBarWidth + layoutInfo.editorPartMinWidth + layoutInfo.sideBarWidth));
			}
			layoutInfo.sideBarWidth = Math.min(layoutInfo.sideBarWidth, window.innerWidth - (layoutInfo.activityBarWidth + layoutInfo.editorPartMinWidth + layoutInfo.auxiliaryBarWidth));

			// part: title
			if (layoutInfo.titleBarHeight > 0) {
				const titleDiv = document.createElement('div');
				titleDiv.style.position = 'absolute';
				titleDiv.style.width = '100%';
				titleDiv.style.height = `${layoutInfo.titleBarHeight}px`;
				titleDiv.style.left = '0';
				titleDiv.style.top = '0';
				titleDiv.style.backgroundColor = modernUI ? 'transparent' : `${colorInfo.titleBarBackground}`;
				(titleDiv.style as CSSStyleDeclaration & { '-webkit-app-region': string })['-webkit-app-region'] = 'drag';
				splash.appendChild(titleDiv);

				if (!modernUI && colorInfo.titleBarBorder) {
					const titleBorder = document.createElement('div');
					titleBorder.style.position = 'absolute';
					titleBorder.style.width = '100%';
					titleBorder.style.height = '1px';
					titleBorder.style.left = '0';
					titleBorder.style.bottom = '0';
					titleBorder.style.borderBottom = `1px solid ${colorInfo.titleBarBorder}`;
					titleDiv.appendChild(titleBorder);
				}
			}

			// part: activity bar
			if (layoutInfo.activityBarWidth > 0) {
				const activityDiv = document.createElement('div');
				const activityBarBounds = layoutInfo.partBounds?.activityBar;
				if (modernUI && activityBarBounds) {
					setPartBounds(activityDiv, activityBarBounds);
				} else if (layoutInfo.modernUICompact === true) {
					setBounds(activityDiv, {
						top: contentTop + (contentTop === 0 ? floatingOuterMargin : 0),
						bottom: contentBottom + floatingOuterMargin,
						...(layoutInfo.sideBarSide === 'left' ? { left: floatingOuterMargin } : { right: floatingOuterMargin }),
						width: Math.max(0, layoutInfo.activityBarWidth - floatingOuterMargin),
					});
				} else {
					activityDiv.style.position = 'absolute';
					activityDiv.style.width = `${layoutInfo.activityBarWidth}px`;
					activityDiv.style.height = activityHeight;
					activityDiv.style.top = `${contentTop}px`;
					if (layoutInfo.sideBarSide === 'left') {
						activityDiv.style.left = '0';
					} else {
						activityDiv.style.right = '0';
					}
				}
				if (layoutInfo.modernUICompact === true) {
					applyFloatingCardStyles(activityDiv, modernActivityBarBackground, activityBarBounds, fallbackOuterEdgesFor('activityBar'), railBorderColor);
				} else if (modernUI) {
					// The rail is a card here too: rounded on the window side, and square where it
					// meets the primary side bar so the two read as one connected surface.
					const radius = `${floatingBorderRadius}px`;
					activityDiv.style.boxSizing = 'border-box';
					activityDiv.style.backgroundColor = modernActivityBarBackground ?? 'transparent';
					activityDiv.style.border = `${floatingBorderWidth}px solid ${railBorderColor}`;
					activityDiv.style.borderRadius = layoutInfo.sideBarWidth === 0 ? radius
						: layoutInfo.sideBarSide === 'left' ? `${radius} 0 0 ${radius}` : `0 ${radius} ${radius} 0`;
					activityDiv.style.overflow = 'hidden';
				} else {
					activityDiv.style.backgroundColor = `${colorInfo.activityBarBackground}`;
				}
				splash.appendChild(activityDiv);

				if (!modernUI && colorInfo.activityBarBorder) {
					const activityBorderDiv = document.createElement('div');
					activityBorderDiv.style.position = 'absolute';
					activityBorderDiv.style.width = '1px';
					activityBorderDiv.style.height = '100%';
					activityBorderDiv.style.top = '0';
					if (layoutInfo.sideBarSide === 'left') {
						activityBorderDiv.style.right = '0';
						activityBorderDiv.style.borderRight = `1px solid ${colorInfo.activityBarBorder}`;
					} else {
						activityBorderDiv.style.left = '0';
						activityBorderDiv.style.borderLeft = `1px solid ${colorInfo.activityBarBorder}`;
					}
					activityDiv.appendChild(activityBorderDiv);
				}
			}

			// part: side bar
			if (layoutInfo.sideBarWidth > 0) {
				// The side bar meets the activity bar rail flush; with no rail it is the outermost
				// card on that edge and takes the cluster's outer gutter instead.
				const sideBarFallbackOuterEdges = fallbackOuterEdgesFor('sideBar');
				const sideBarClusterInset = modernUI && sideBarFallbackOuterEdges[layoutInfo.sideBarSide === 'left' ? 'left' : 'right'] ? floatingOuterMargin : 0;
				const sideDiv = document.createElement('div');
				if (modernUI && layoutInfo.partBounds?.sideBar) {
					setPartBounds(sideDiv, layoutInfo.partBounds.sideBar);
				} else if (layoutInfo.sideBarSide === 'left') {
					setBounds(sideDiv, {
						top: contentTop + (contentTop === 0 ? fallbackInsetFor('sideBar', 'top') : 0),
						bottom: contentBottom + fallbackInsetFor('sideBar', 'bottom'),
						left: layoutInfo.activityBarWidth + sideBarClusterInset,
						width: modernUI ? Math.max(0, layoutInfo.sideBarWidth - sideBarClusterInset - floatingBorderWidth * 2) : layoutInfo.sideBarWidth
					});
				} else {
					setBounds(sideDiv, {
						top: contentTop + (contentTop === 0 ? fallbackInsetFor('sideBar', 'top') : 0),
						bottom: contentBottom + fallbackInsetFor('sideBar', 'bottom'),
						right: layoutInfo.activityBarWidth + sideBarClusterInset,
						width: modernUI ? Math.max(0, layoutInfo.sideBarWidth - sideBarClusterInset - floatingBorderWidth * 2) : layoutInfo.sideBarWidth
					});
				}
				if (modernUI) {
					applyFloatingCardStyles(sideDiv, colorInfo.surfaceBackground ?? colorInfo.agentsPanelBackground ?? colorInfo.sideBarBackground, layoutInfo.partBounds?.sideBar, sideBarFallbackOuterEdges);
				} else {
					sideDiv.style.backgroundColor = `${colorInfo.sideBarBackground}`;
				}
				splash.appendChild(sideDiv);

				if (!modernUI && colorInfo.sideBarBorder) {
					const sideBorderDiv = document.createElement('div');
					sideBorderDiv.style.position = 'absolute';
					sideBorderDiv.style.width = '1px';
					sideBorderDiv.style.height = '100%';
					sideBorderDiv.style.top = '0';
					sideBorderDiv.style.right = '0';
					if (layoutInfo.sideBarSide === 'left') {
						sideBorderDiv.style.borderRight = `1px solid ${colorInfo.sideBarBorder}`;
					} else {
						sideBorderDiv.style.left = '0';
						sideBorderDiv.style.borderLeft = `1px solid ${colorInfo.sideBarBorder}`;
					}
					sideDiv.appendChild(sideBorderDiv);
				}
			}

			// part: auxiliary sidebar
			if (layoutInfo.auxiliaryBarWidth > 0) {
				const auxiliaryBarFallbackOuterEdges = fallbackOuterEdgesFor('auxiliaryBar');
				const auxSideDiv = document.createElement('div');
				if (modernUI && layoutInfo.partBounds?.auxiliaryBar) {
					setPartBounds(auxSideDiv, layoutInfo.partBounds.auxiliaryBar);
				} else if (layoutInfo.sideBarSide === 'left') {
					setBounds(auxSideDiv, {
						top: contentTop + (contentTop === 0 ? fallbackInsetFor('auxiliaryBar', 'top') : 0),
						bottom: contentBottom + fallbackInsetFor('auxiliaryBar', 'bottom'),
						right: fallbackInsetFor('auxiliaryBar', 'right'),
						width: modernUI ? Math.max(0, layoutInfo.auxiliaryBarWidth - fallbackInsetFor('auxiliaryBar', 'right') - floatingMargin - floatingBorderWidth * 2) : layoutInfo.auxiliaryBarWidth
					});
				} else {
					setBounds(auxSideDiv, {
						top: contentTop + (contentTop === 0 ? fallbackInsetFor('auxiliaryBar', 'top') : 0),
						bottom: contentBottom + fallbackInsetFor('auxiliaryBar', 'bottom'),
						left: fallbackInsetFor('auxiliaryBar', 'left'),
						width: modernUI ? Math.max(0, layoutInfo.auxiliaryBarWidth - fallbackInsetFor('auxiliaryBar', 'left') - floatingMargin - floatingBorderWidth * 2) : layoutInfo.auxiliaryBarWidth
					});
				}
				if (modernUI) {
					applyFloatingCardStyles(auxSideDiv, colorInfo.sideBarBackground, layoutInfo.partBounds?.auxiliaryBar, auxiliaryBarFallbackOuterEdges);
				} else {
					auxSideDiv.style.backgroundColor = `${colorInfo.sideBarBackground}`;
				}
				splash.appendChild(auxSideDiv);

				if (!modernUI && colorInfo.sideBarBorder) {
					const auxSideBorderDiv = document.createElement('div');
					auxSideBorderDiv.style.position = 'absolute';
					auxSideBorderDiv.style.width = '1px';
					auxSideBorderDiv.style.height = '100%';
					auxSideBorderDiv.style.top = '0';
					if (layoutInfo.sideBarSide === 'left') {
						auxSideBorderDiv.style.left = '0';
						auxSideBorderDiv.style.borderLeft = `1px solid ${colorInfo.sideBarBorder}`;
					} else {
						auxSideBorderDiv.style.right = '0';
						auxSideBorderDiv.style.borderRight = `1px solid ${colorInfo.sideBarBorder}`;
					}
					auxSideDiv.appendChild(auxSideBorderDiv);
				}
			}

			if (modernUI && (layoutInfo.partBounds?.editor || !layoutInfo.partBounds)) {
				const editorFallbackOuterEdges = fallbackOuterEdgesFor('editor');
				const editorDiv = document.createElement('div');
				if (layoutInfo.partBounds?.editor) {
					setPartBounds(editorDiv, layoutInfo.partBounds.editor);
				} else {
					const editorLeft = (layoutInfo.sideBarSide === 'left' ? layoutInfo.activityBarWidth + layoutInfo.sideBarWidth : layoutInfo.auxiliaryBarWidth) + fallbackInsetFor('editor', 'left');
					const editorRight = (layoutInfo.sideBarSide === 'left' ? layoutInfo.auxiliaryBarWidth : layoutInfo.activityBarWidth + layoutInfo.sideBarWidth) + fallbackInsetFor('editor', 'right');
					setBounds(editorDiv, {
						top: contentTop + (contentTop === 0 ? fallbackInsetFor('editor', 'top') : 0),
						bottom: contentBottom + fallbackInsetFor('editor', 'bottom'),
						left: editorLeft,
						right: editorRight
					});
				}
				applyFloatingCardStyles(editorDiv, colorInfo.editorBackground, layoutInfo.partBounds?.editor, editorFallbackOuterEdges, colorInfo.editorBorder ?? colorInfo.surfaceBorder ?? colorInfo.editorGroupBorder ?? 'transparent');
				splash.appendChild(editorDiv);
			}

			if (modernUI && layoutInfo.partBounds?.panel) {
				const panelDiv = document.createElement('div');
				setPartBounds(panelDiv, layoutInfo.partBounds.panel);
				applyFloatingCardStyles(panelDiv, colorInfo.panelBackground ?? colorInfo.editorBackground, layoutInfo.partBounds.panel);
				splash.appendChild(panelDiv);
			}

			// part: statusbar
			if (layoutInfo.statusBarHeight > 0) {
				const statusDiv = document.createElement('div');
				statusDiv.style.position = 'absolute';
				statusDiv.style.width = '100%';
				statusDiv.style.height = `${layoutInfo.statusBarHeight}px`;
				statusDiv.style.bottom = '0';
				statusDiv.style.left = '0';
				if (modernUI) {
					statusDiv.style.backgroundColor = 'transparent';
				} else if (configuration.workspace && colorInfo.statusBarBackground) {
					statusDiv.style.backgroundColor = colorInfo.statusBarBackground;
				} else if (!configuration.workspace && colorInfo.statusBarNoFolderBackground) {
					statusDiv.style.backgroundColor = colorInfo.statusBarNoFolderBackground;
				}
				splash.appendChild(statusDiv);

				if (!modernUI && colorInfo.statusBarBorder) {
					const statusBorderDiv = document.createElement('div');
					statusBorderDiv.style.position = 'absolute';
					statusBorderDiv.style.width = '100%';
					statusBorderDiv.style.height = '1px';
					statusBorderDiv.style.top = '0';
					statusBorderDiv.style.borderTop = `1px solid ${colorInfo.statusBarBorder}`;
					statusDiv.appendChild(statusBorderDiv);
				}
			}

			showKyubiLogo(splash);

			window.document.body.appendChild(splash);
		} else {
			// No stored layout info: still show the Kyubi logo centered on the shell background
			const splash = document.createElement('div');
			splash.id = 'monaco-parts-splash';
			splash.className = baseTheme ?? 'vs-dark';
			showKyubiLogo(splash);
			window.document.body.appendChild(splash);
		}
	}

	//#endregion

	//#region Window Helpers

	async function load<M, T extends ISandboxConfiguration>(options: ILoadOptions<T>): Promise<ILoadResult<M, T>> {

		// Window Configuration from Preload Script
		const configuration = await resolveWindowConfiguration<T>();

		// Signal before import()
		options?.beforeImport?.(configuration);

		// Developer settings
		const { enableDeveloperKeybindings, removeDeveloperKeybindingsAfterLoad, developerDeveloperKeybindingsDisposable, forceDisableShowDevtoolsOnError } = setupDeveloperKeybindings(configuration, options);

		// NLS
		setupNLS<T>(configuration);

		// Compute base URL and set as global
		const baseUrl = new URL(`${fileUriFromPath(configuration.appRoot, { isWindows: safeProcess.platform === 'win32', scheme: 'vscode-file', fallbackAuthority: 'vscode-app' })}/out/`);
		globalThis._VSCODE_FILE_ROOT = baseUrl.toString();

		// Set product configuration as global (used e.g. to select the ASAR path in `amdX`)
		globalThis._VSCODE_PRODUCT_JSON = { ...configuration.product };

		// Dev only: CSS import map tricks
		setupCSSImportMaps<T>(configuration, baseUrl);

		// ESM Import
		try {
			let workbenchUrl: string;
			if (!!safeProcess.env['VSCODE_DEV'] && globalThis._VSCODE_USE_RELATIVE_IMPORTS) {
				workbenchUrl = '../../../workbench/workbench.desktop.main.js'; // for dev purposes only
			} else {
				workbenchUrl = new URL(`vs/workbench/workbench.desktop.main.js`, baseUrl).href;
			}

			const result = await import(workbenchUrl);
			if (developerDeveloperKeybindingsDisposable && removeDeveloperKeybindingsAfterLoad) {
				developerDeveloperKeybindingsDisposable();
			}

			return { result, configuration };
		} catch (error) {
			onUnexpectedError(error, enableDeveloperKeybindings && !forceDisableShowDevtoolsOnError);

			throw error;
		}
	}

	async function resolveWindowConfiguration<T extends ISandboxConfiguration>() {
		const timeout = setTimeout(() => { console.error(`[resolve window config] Could not resolve window configuration within 10 seconds, but will continue to wait...`); }, 10000);
		performance.mark('code/willWaitForWindowConfig');

		const configuration = await preloadGlobals.context.resolveConfiguration() as T;
		performance.mark('code/didWaitForWindowConfig');

		clearTimeout(timeout);

		return configuration;
	}

	function setupDeveloperKeybindings<T extends ISandboxConfiguration>(configuration: T, options: ILoadOptions<T>) {
		const {
			forceEnableDeveloperKeybindings,
			disallowReloadKeybinding,
			removeDeveloperKeybindingsAfterLoad,
			forceDisableShowDevtoolsOnError
		} = typeof options?.configureDeveloperSettings === 'function' ? options.configureDeveloperSettings(configuration) : {
			forceEnableDeveloperKeybindings: false,
			disallowReloadKeybinding: false,
			removeDeveloperKeybindingsAfterLoad: false,
			forceDisableShowDevtoolsOnError: false
		};

		const isDev = !!safeProcess.env['VSCODE_DEV'];
		const enableDeveloperKeybindings = Boolean(isDev || forceEnableDeveloperKeybindings);
		let developerDeveloperKeybindingsDisposable: Function | undefined = undefined;
		if (enableDeveloperKeybindings) {
			developerDeveloperKeybindingsDisposable = registerDeveloperKeybindings(disallowReloadKeybinding);
		}

		return {
			enableDeveloperKeybindings,
			removeDeveloperKeybindingsAfterLoad,
			developerDeveloperKeybindingsDisposable,
			forceDisableShowDevtoolsOnError
		};
	}

	function registerDeveloperKeybindings(disallowReloadKeybinding: boolean | undefined): Function {
		const ipcRenderer = preloadGlobals.ipcRenderer;

		const extractKey =
			function (e: KeyboardEvent) {
				return [
					e.ctrlKey ? 'ctrl-' : '',
					e.metaKey ? 'meta-' : '',
					e.altKey ? 'alt-' : '',
					e.shiftKey ? 'shift-' : '',
					e.keyCode
				].join('');
			};

		// Devtools & reload support
		const TOGGLE_DEV_TOOLS_KB = (safeProcess.platform === 'darwin' ? 'meta-alt-73' : 'ctrl-shift-73'); // mac: Cmd-Alt-I, rest: Ctrl-Shift-I
		const TOGGLE_DEV_TOOLS_KB_ALT = '123'; // F12
		const RELOAD_KB = (safeProcess.platform === 'darwin' ? 'meta-82' : 'ctrl-82'); // mac: Cmd-R, rest: Ctrl-R

		let listener: ((e: KeyboardEvent) => void) | undefined = function (e) {
			const key = extractKey(e);
			if (key === TOGGLE_DEV_TOOLS_KB || key === TOGGLE_DEV_TOOLS_KB_ALT) {
				ipcRenderer.send('vscode:toggleDevTools');
			} else if (key === RELOAD_KB && !disallowReloadKeybinding) {
				ipcRenderer.send('vscode:reloadWindow');
			}
		};

		window.addEventListener('keydown', listener);

		return function () {
			if (listener) {
				window.removeEventListener('keydown', listener);
				listener = undefined;
			}
		};
	}

	function setupNLS<T extends ISandboxConfiguration>(configuration: T): void {
		globalThis._VSCODE_NLS_MESSAGES = configuration.nls.messages;
		globalThis._VSCODE_NLS_LANGUAGE = configuration.nls.language;

		let language = configuration.nls.language || 'en';
		if (language === 'zh-tw') {
			language = 'zh-Hant';
		} else if (language === 'zh-cn') {
			language = 'zh-Hans';
		}

		window.document.documentElement.setAttribute('lang', language);
	}

	function onUnexpectedError(error: string | Error, showDevtoolsOnError: boolean): void {
		if (showDevtoolsOnError) {
			const ipcRenderer = preloadGlobals.ipcRenderer;
			ipcRenderer.send('vscode:openDevTools');
		}

		console.error(`[uncaught exception]: ${error}`);

		if (error && typeof error !== 'string' && error.stack) {
			console.error(error.stack);
		}
	}

	function fileUriFromPath(path: string, config: { isWindows?: boolean; scheme?: string; fallbackAuthority?: string }): string {

		// Since we are building a URI, we normalize any backslash
		// to slashes and we ensure that the path begins with a '/'.
		let pathName = path.replace(/\\/g, '/');
		if (pathName.length > 0 && pathName.charAt(0) !== '/') {
			pathName = `/${pathName}`;
		}

		let uri: string;

		// Windows: in order to support UNC paths (which start with '//')
		// that have their own authority, we do not use the provided authority
		// but rather preserve it.
		if (config.isWindows && pathName.startsWith('//')) {
			uri = encodeURI(`${config.scheme || 'file'}:${pathName}`);
		}

		// Otherwise we optionally add the provided authority if specified
		else {
			uri = encodeURI(`${config.scheme || 'file'}://${config.fallbackAuthority || ''}${pathName}`);
		}

		return uri.replace(/#/g, '%23');
	}

	function setupCSSImportMaps<T extends ISandboxConfiguration>(configuration: T, baseUrl: URL) {

		// DEV ---------------------------------------------------------------------------------------
		// DEV: This is for development and enables loading CSS via import-statements via import-maps.
		// DEV: For each CSS modules that we have we defined an entry in the import map that maps to
		// DEV: a blob URL that loads the CSS via a dynamic @import-rule.
		// DEV ---------------------------------------------------------------------------------------

		if (globalThis._VSCODE_DISABLE_CSS_IMPORT_MAP) {
			return; // disabled in certain development setups
		}

		if (Array.isArray(configuration.cssModules) && configuration.cssModules.length > 0) {
			performance.mark('code/willAddCssLoader');

			globalThis._VSCODE_CSS_LOAD = function (url) {
				const link = document.createElement('link');
				link.setAttribute('rel', 'stylesheet');
				link.setAttribute('type', 'text/css');
				link.setAttribute('href', url);

				window.document.head.appendChild(link);
			};

			const importMap: { imports: Record<string, string> } = { imports: {} };
			for (const cssModule of configuration.cssModules) {
				const cssUrl = new URL(cssModule, baseUrl).href;
				const jsSrc = `globalThis._VSCODE_CSS_LOAD('${cssUrl}');\n`;
				const blob = new Blob([jsSrc], { type: 'application/javascript' });
				importMap.imports[cssUrl] = URL.createObjectURL(blob);
			}

			const ttp = window.trustedTypes?.createPolicy('vscode-bootstrapImportMap', { createScript(value) { return value; }, });
			const importMapSrc = JSON.stringify(importMap, undefined, 2);
			const importMapScript = document.createElement('script');
			importMapScript.type = 'importmap';
			importMapScript.setAttribute('nonce', '0c6a828f1297');
			// @ts-expect-error
			importMapScript.textContent = ttp?.createScript(importMapSrc) ?? importMapSrc;
			window.document.head.appendChild(importMapScript);

			performance.mark('code/didAddCssLoader');
		}
	}

	//#endregion

	const { result, configuration } = await load<IDesktopMain, INativeWindowConfiguration>(
		{
			configureDeveloperSettings: function (windowConfig) {
				return {
					// disable automated devtools opening on error when running extension tests
					// as this can lead to nondeterministic test execution (devtools steals focus)
					forceDisableShowDevtoolsOnError: typeof windowConfig.extensionTestsPath === 'string' || windowConfig['enable-smoke-test-driver'] === true,
					// enable devtools keybindings in extension development window
					forceEnableDeveloperKeybindings: Array.isArray(windowConfig.extensionDevelopmentPath) && windowConfig.extensionDevelopmentPath.length > 0,
					removeDeveloperKeybindingsAfterLoad: true
				};
			},
			beforeImport: function (windowConfig) {

				// Show our splash as early as possible
				showSplash(windowConfig);

				// Code windows have a `vscodeWindowId` property to identify them
				Object.defineProperty(window, 'vscodeWindowId', {
					get: () => windowConfig.windowId
				});

				// It looks like browsers only lazily enable
				// the <canvas> element when needed. Since we
				// leverage canvas elements in our code in many
				// locations, we try to help the browser to
				// initialize canvas when it is idle, right
				// before we wait for the scripts to be loaded.
				window.requestIdleCallback(() => {
					const canvas = document.createElement('canvas');
					const context = canvas.getContext('2d');
					context?.clearRect(0, 0, canvas.width, canvas.height);
					canvas.remove();
				}, { timeout: 50 });

				// Track import() perf
				performance.mark('code/willLoadWorkbenchMain');
			}
		}
	);

	// Mark start of workbench
	performance.mark('code/didLoadWorkbenchMain');

	// Load workbench
	result.main(configuration);
}());
