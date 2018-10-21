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

    context.subscriptions.push(disposable1, registration);
}

export function deactivate() {
}