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

    let disposable0 = vscode.commands.registerCommand('extension.previewLink', () => {
        let ibo = <vscode.InputBoxOptions>{
            prompt: "url to preview",
            placeHolder: "https://..."
        }
        vscode.window.showInputBox(ibo).then( async (link) => {
            let webPanel = vscode.window.createWebviewPanel('PreviewHtml', 'Preview Link', -1, {enableFindWidget: true, enableScripts: true });
            const response = await got(link);
            webPanel.webview.html = response.body;
            webPanel.reveal();
        });
    });

    let disposable1 = vscode.commands.registerCommand('extension.openLink', () => {
        var ibo = <vscode.InputBoxOptions>{
            prompt: "url to download",
            placeHolder: "https://..."
        }
        vscode.window.showInputBox(ibo).then( link => {
            var uri = vscode.Uri.parse(link).with({ scheme: linkScheme});
            vscode.workspace.openTextDocument(uri).then(doc => {
                vscode.window.showTextDocument(doc);
            });
        });
    });

    let disposable2 = vscode.commands.registerCommand('extension.downloadLink', () => {
        if (vscode.workspace.rootPath == undefined) {
            return;
        }
        var ibo = <vscode.InputBoxOptions>{
            prompt: "url to download",
            placeHolder: "https://...",
            ignoreFocusOut: true
        }
        vscode.window.showInputBox(ibo).then(link => {
            if (!link) {
                return;
            }
            var uri = vscode.Uri.parse(link);
            ibo.value = path.basename(uri.toString());
            ibo.prompt = "filename";
            ibo.placeHolder = "filename";
            vscode.window.showInputBox(ibo).then(filename => {
                var filepath = path.join(vscode.workspace.rootPath, filename)
                got.stream(uri.toString())
                    .on('downloadProgress', p => { console.log(p) })
                    .pipe(fs.createWriteStream(filepath))
                    .on('finish', () => {
                        let fileUri = vscode.Uri.file(filepath);
                        vscode.commands.executeCommand('vscode.open', fileUri);
                    });
            });
        });
    });

    context.subscriptions.push(disposable2, disposable1, disposable0, registration);
}

export function deactivate() {
}