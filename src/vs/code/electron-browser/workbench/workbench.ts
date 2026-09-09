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
	const KYUBI_SPLASH_LOGO = 'data:image/jpeg;base64,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';

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
		logo.style.width = 'min(420px, 60vw)';
		logo.style.height = 'auto';
		logo.style.borderRadius = '12px';
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
