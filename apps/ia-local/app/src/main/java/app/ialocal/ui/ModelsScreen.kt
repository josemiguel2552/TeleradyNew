package app.ialocal.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.ialocal.data.DownloadState
import app.ialocal.data.ModelCatalog
import app.ialocal.data.ModelStore
import java.io.File
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelsScreen(vm: AppViewModel) {
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(vm.notice) {
        vm.notice?.let { snackbar.showSnackbar(it); vm.notice = null }
    }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) vm.import(uri)
    }
    var toDelete by remember { mutableStateOf<File?>(null) }
    var editingPrompt by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Modelos") },
                navigationIcon = {
                    if (vm.activeModel != null) {
                        IconButton(onClick = { vm.screen = Screen.Chat }) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, "Volver al chat")
                        }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Text(
                    "Descarga un modelo una sola vez (con Wi-Fi). Después la IA funciona sin internet. " +
                        "Tu teléfono tiene unos ${vm.totalRamGb} GB de RAM.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (vm.loadingModel) {
                item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
            }

            if (vm.installed.isNotEmpty()) {
                item { SectionTitle("En el teléfono") }
                items(vm.installed, key = { "f:" + it.name }) { file ->
                    InstalledCard(
                        file = file,
                        active = vm.activeModel == file.name,
                        enabled = !vm.loadingModel,
                        onUse = { vm.loadModel(file) },
                        onDelete = { toDelete = file },
                    )
                }
            }

            val available = ModelCatalog.models.filter { m -> vm.installed.none { it.name == m.fileName } }
            if (available.isNotEmpty()) {
                item { SectionTitle("Descargar") }
                items(available, key = { "c:" + it.id }) { m ->
                    val state = vm.downloads[m.fileName]
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(m.name, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                                Text(m.sizeLabel, style = MaterialTheme.typography.labelLarge)
                            }
                            Spacer(Modifier.size(4.dp))
                            Text(m.description, style = MaterialTheme.typography.bodyMedium)
                            if (vm.totalRamGb in 1 until m.minRamGb) {
                                Text(
                                    "Recomendado: ${m.minRamGb} GB de RAM o más; puede ir lento o cerrarse.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.error,
                                )
                            }
                            Spacer(Modifier.size(12.dp))
                            if (state is DownloadState.Running) {
                                val frac = if (state.total > 0) state.downloaded.toFloat() / state.total else null
                                if (frac != null) LinearProgressIndicator(progress = { frac }, modifier = Modifier.fillMaxWidth())
                                else LinearProgressIndicator(Modifier.fillMaxWidth())
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        formatBytes(state.downloaded) + if (state.total > 0) " / " + formatBytes(state.total) else "",
                                        style = MaterialTheme.typography.bodySmall,
                                        modifier = Modifier.weight(1f),
                                    )
                                    TextButton(onClick = { vm.cancelDownload(m) }) { Text("Cancelar") }
                                }
                            } else {
                                Button(onClick = { vm.download(m) }) { Text("Descargar") }
                            }
                        }
                    }
                }
            }

            item {
                SectionTitle("¿Ya tienes un archivo .gguf?")
                Spacer(Modifier.size(8.dp))
                val p = vm.importProgress
                if (p != null) {
                    LinearProgressIndicator(progress = { p }, modifier = Modifier.fillMaxWidth())
                    Text("Copiando… ${(p * 100).toInt()} %", style = MaterialTheme.typography.bodySmall)
                } else {
                    OutlinedButton(onClick = { picker.launch(arrayOf("*/*")) }) { Text("Importar desde el teléfono") }
                }
            }

            item {
                SectionTitle("Personalidad del asistente")
                Spacer(Modifier.size(8.dp))
                Text(vm.systemPrompt, style = MaterialTheme.typography.bodySmall, maxLines = 4)
                TextButton(onClick = { editingPrompt = true }) { Text("Editar") }
            }
        }
    }

    toDelete?.let { file ->
        AlertDialog(
            onDismissRequest = { toDelete = null },
            title = { Text("¿Borrar modelo?") },
            text = { Text("Se eliminará ${file.name} (${formatBytes(file.length())}). Tendrás que descargarlo otra vez para usarlo.") },
            confirmButton = { TextButton(onClick = { vm.deleteModel(file); toDelete = null }) { Text("Borrar") } },
            dismissButton = { TextButton(onClick = { toDelete = null }) { Text("Cancelar") } },
        )
    }

    if (editingPrompt) {
        var draft by remember { mutableStateOf(vm.systemPrompt) }
        AlertDialog(
            onDismissRequest = { editingPrompt = false },
            title = { Text("Instrucciones del sistema") },
            text = {
                OutlinedTextField(value = draft, onValueChange = { draft = it }, minLines = 4, maxLines = 10)
            },
            confirmButton = {
                TextButton(onClick = { vm.updateSystemPrompt(draft); editingPrompt = false }) { Text("Guardar") }
            },
            dismissButton = {
                TextButton(onClick = { draft = ModelStore.DEFAULT_SYSTEM_PROMPT }) { Text("Restablecer") }
            },
        )
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
}

@Composable
private fun InstalledCard(file: File, active: Boolean, enabled: Boolean, onUse: () -> Unit, onDelete: () -> Unit) {
    val catalog = ModelCatalog.byFileName(file.name)
    Card(
        Modifier.fillMaxWidth(),
        colors = if (active) CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
        else CardDefaults.cardColors(),
    ) {
        Row(Modifier.padding(start = 16.dp, top = 8.dp, bottom = 8.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(catalog?.name ?: file.name.removeSuffix(".gguf"), style = MaterialTheme.typography.titleMedium)
                Text(formatBytes(file.length()), style = MaterialTheme.typography.bodySmall)
            }
            if (active) {
                Icon(Icons.Filled.Check, "En uso", Modifier.padding(horizontal = 12.dp))
            } else {
                TextButton(onClick = onUse, enabled = enabled) { Text("Usar") }
            }
            IconButton(onClick = onDelete, enabled = enabled) { Icon(Icons.Filled.Delete, "Borrar") }
        }
    }
}

private fun formatBytes(b: Long): String {
    if (b < 0) return "?"
    val gb = b / 1_073_741_824.0
    return if (gb >= 1) String.format(Locale.getDefault(), "%.2f GB", gb)
    else String.format(Locale.getDefault(), "%.0f MB", b / 1_048_576.0)
}
