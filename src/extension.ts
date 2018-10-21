'use strict';
import * as vscode from 'vscode';

import got = require('got');
import path = require('path');
import fs = require('fs');

export function activate(context: vscode.ExtensionContext) {
    const linkScheme = "http-link";
    class LinkContentProvider implements vscode.TextDocumentContentProvider {
        public provideTextDocumentContent(uri: vscode.Uri): Thenable<string> {
            //TODO: support both http and https
            var linkUri = uri.with({ scheme: 'https' });
            console.log(linkUri.toString());
            
            return new Promise((resolve) => 
            {
                got(linkUri.toString()).then(response => {
                    console.log(response);
                    resolve(response.body); 
                }).catch(error => {
                    console.log(error);
                    vscode.window.showErrorMessage(error.toString());
                });
            });
        }
    }

    let provider = new LinkContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider(linkScheme, provider);

    let disposable0 = vscode.commands.registerCommand('extension.previewLink', async () => {
        let ibo = <vscode.InputBoxOptions>{
            prompt: "url to preview",
            placeHolder: "https://..."
        }
        const link = await vscode.window.showInputBox(ibo);
        let webPanel = vscode.window.createWebviewPanel('PreviewHtml', 'Preview Link', -1, {enableFindWidget: true, enableScripts: true });
        const response = await got(link);
        webPanel.webview.html = response.body;
        webPanel.reveal();
    });

    let disposable1 = vscode.commands.registerCommand('extension.openLink', async () => {
        var ibo = <vscode.InputBoxOptions>{
            prompt: "url to download",
            placeHolder: "https://..."
        }
        const link = await vscode.window.showInputBox(ibo);
        var uri = vscode.Uri.parse(link).with({ scheme: linkScheme});
        const doc = await vscode.workspace.openTextDocument(uri)
        vscode.window.showTextDocument(doc);
    });

    let disposable2 = vscode.commands.registerCommand('extension.downloadLink', async () => {
        if (vscode.workspace.rootPath == undefined) {
            return;
        }
        var ibo = <vscode.InputBoxOptions>{
            prompt: "url to download",
            placeHolder: "https://...",
            ignoreFocusOut: true
        }
        const link = await vscode.window.showInputBox(ibo);
        if (!link) {
            return;
        }
        var uri = vscode.Uri.parse(link);
        ibo.value = path.basename(uri.toString());
        ibo.prompt = "filename";
        ibo.placeHolder = "filename";
        const filename = await vscode.window.showInputBox(ibo);
        var filepath = path.join(vscode.workspace.rootPath, filename);
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "downloading " + filename,
            cancellable: true
        }, (progress, token) => {
            let percent = 0;
            let transferred = 0;
            progress.report({ increment: 0 });
            return new Promise(resolve => {
                let cancelled = false;

                let stream = got.stream(uri.toString(), {timeout: {connect: 10000, socket: 10000}});
                let fileStream = stream.pipe(fs.createWriteStream(filepath + '.download'));
                
                token.onCancellationRequested(() => {
                    cancelled = true;
                    stream.pause();
                    stream.end(() => {
                        console.log('stream cancelled end');
                        fileStream.close();
                    });
                });

                stream.on('downloadProgress', p => {
                    if (percent < Math.floor(p.percent * 100)) {
                        percent = Math.floor(p.percent * 100);
                        let incr = p.total > 0 ? (p.transferred - transferred) / p.total : 0;
                        progress.report({increment: incr * 100, message: `${Math.floor(percent)}%`})
                        transferred = p.transferred;
                    }
                });

                fileStream.on('close', async () => {
                    const yes: vscode.MessageItem = { title: "Yes" };
                    const no: vscode.MessageItem = { isCloseAffordance: true, title: "No" };
                    if (cancelled) {
                        const v = await vscode.window.showWarningMessage("Download cancelled. Delete file?", yes, no);
                        if (v === yes) {
                            fs.unlink(filepath + '.download', (e) => {
                                if (e) {
                                    console.log(e);
                                }
                                resolve();
                            });
                        }
                    } else {
                        fs.rename(filepath + '.download', filepath, async (err) => {
                            if (err) {
                                vscode.window.showErrorMessage("Could not rename file \"" + filepath + "\"");
                            } 
                            else {
                                const v = await vscode.window.showInformationMessage("Download completed. Open file?", yes, no)
                                if (v === yes) {
                                    let fileUri = vscode.Uri.file(filepath);
                                    vscode.commands.executeCommand('vscode.open', fileUri);
                                }
                            }

                            resolve();
                        });
                    }
                });
            });
        });
    });



    let disposable3 = vscode.commands.registerCommand('extension.openPath', () => {
        var ibo = <vscode.InputBoxOptions>{
            prompt: "path to open",
            placeHolder: "/path/to/open"
        }
        vscode.window.showInputBox(ibo).then(link => {
            var uri = vscode.Uri.file(link);
            vscode.commands.executeCommand('vscode.open', uri);
        });
    });

    context.subscriptions.push(disposable3, disposable2, disposable1, disposable0, registration);
}

export function deactivate() {
}