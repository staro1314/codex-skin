using System.Text.Json;

namespace CodexDreamSkin.Client;

internal sealed record ProductIdentity(
    string DisplayName,
    string StudioName,
    string PackageStem)
{
    public static ProductIdentity Load(string runtimeRoot)
    {
        var path = Path.Combine(runtimeRoot, "assets", "product.json");
        if (!File.Exists(path))
            throw new FileNotFoundException("The generated product configuration is missing.", path);

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(path));
            var root = document.RootElement;
            var schema = RequiredString(root, "schema");
            var displayName = RequiredString(root, "displayName");
            var studioName = RequiredString(root, "studioName");
            var packageStem = RequiredString(root, "packageStem");
            if (schema != "codex-skin/product/1" ||
                !System.Text.RegularExpressions.Regex.IsMatch(packageStem, "^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$"))
                throw new InvalidDataException("The generated product configuration schema is unsupported.");

            return new ProductIdentity(displayName, studioName, packageStem);
        }
        catch (JsonException error)
        {
            throw new InvalidDataException("The generated product configuration is not valid JSON.", error);
        }
    }

    private static string RequiredString(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value) ||
            value.ValueKind != JsonValueKind.String ||
            string.IsNullOrWhiteSpace(value.GetString()))
            throw new InvalidDataException($"The generated product configuration is missing {name}.");
        return value.GetString()!;
    }
}
