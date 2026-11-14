package app.ialocal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(vm: AppViewModel) {
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(vm.notice) {
        vm.notice?.let { snackbar.showSnackbar(it); vm.notice = null }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("IA Local")
                        Text(
                            text = when {
                                vm.loadingModel -> "Cargando modelo…"
                                vm.activeModel != null -> vm.activeModel!!.removeSuffix(".gguf") + " · sin conexión"
                                else -> "Sin modelo"
                            },
                            style = MaterialTheme.typography.labelSmall,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                },
                actions = {
                    IconButton(onClick = vm::newChat) { Icon(Icons.Filled.Add, "Nuevo chat") }
                    IconButton(onClick = { vm.screen = Screen.Models }) { Icon(Icons.Filled.Settings, "Modelos y ajustes") }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .consumeWindowInsets(padding)
                .imePadding()
        ) {
            val listState = rememberLazyListState()
            val last = vm.messages.lastOrNull()
            LaunchedEffect(vm.messages.size, last?.text?.length) {
                if (vm.messages.isNotEmpty()) listState.scrollToItem(vm.messages.lastIndex, Int.MAX_VALUE / 2)
            }

            Box(Modifier.weight(1f).fillMaxWidth()) {
                if (vm.messages.isEmpty()) {
                    EmptyState(vm)
                } else {
                    LazyColumn(
                        state = listState,
                        contentPadding = PaddingValues(12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxSize(),
                    ) {
                        items(vm.messages, key = { it.id }) { msg ->
                            MessageBubble(msg, typing = vm.isGenerating && msg === last && msg.text.isEmpty())
                        }
                        if (!vm.isGenerating && last?.role == "assistant") {
                            item {
                                TextButton(onClick = vm::regenerate) {
                                    Icon(Icons.Filled.Refresh, null, Modifier.size(18.dp))
                                    Spacer(Modifier.size(6.dp))
                                    Text("Regenerar")
                                }
                            }
                        }
                    }
                }
            }
            InputBar(vm)
        }
    }
}

@Composable
private fun EmptyState(vm: AppViewModel) {
    Column(
        Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (vm.loadingModel) {
            CircularProgressIndicator()
            Spacer(Modifier.size(16.dp))
            Text("Cargando el modelo en memoria…")
        } else {
            Text("¿En qué te ayudo?", style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.size(8.dp))
            Text(
                "Todo se procesa en tu teléfono. Funciona en modo avión.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun MessageBubble(msg: UiMessage, typing: Boolean) {
    val isUser = msg.role == "user"
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start) {
        Surface(
            color = when {
                msg.isError -> MaterialTheme.colorScheme.errorContainer
                isUser -> MaterialTheme.colorScheme.primaryContainer
                else -> MaterialTheme.colorScheme.surfaceVariant
            },
            shape = RoundedCornerShape(
                topStart = 18.dp, topEnd = 18.dp,
                bottomStart = if (isUser) 18.dp else 4.dp,
                bottomEnd = if (isUser) 4.dp else 18.dp,
            ),
            modifier = Modifier.widthIn(max = 520.dp),
        ) {
            Box(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                if (typing) {
                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    SelectionContainer { Text(msg.text, style = MaterialTheme.typography.bodyLarge) }
                }
            }
        }
    }
}

@Composable
private fun InputBar(vm: AppViewModel) {
    var text by rememberSaveable { mutableStateOf("") }
    Row(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        OutlinedTextField(
            value = text,
            onValueChange = { text = it },
            placeholder = { Text("Escribe un mensaje") },
            modifier = Modifier.weight(1f),
            maxLines = 6,
            shape = RoundedCornerShape(24.dp),
        )
        Spacer(Modifier.size(8.dp))
        if (vm.isGenerating) {
            FilledIconButton(onClick = vm::stopGeneration, modifier = Modifier.size(52.dp)) {
                Icon(Icons.Filled.Close, "Detener")
            }
        } else {
            FilledIconButton(
                onClick = { vm.send(text); if (vm.activeModel != null) text = "" },
                enabled = text.isNotBlank() && !vm.loadingModel,
                modifier = Modifier.size(52.dp),
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, "Enviar")
            }
        }
    }
}
